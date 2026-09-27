import os
import uuid
import hmac
import json
import hashlib
import secrets
import logging
from datetime import datetime, timezone, timedelta, date
from typing import Optional, Literal, List
from contextlib import asynccontextmanager

import jwt
import httpx
import aiosmtplib
from email.message import EmailMessage
from fastapi import FastAPI, HTTPException, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rentify")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "rentify_db")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev_secret")
JWT_ALG = "HS256"
JWT_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "10080"))
OTP_MINUTES = int(os.environ.get("OTP_EXPIRE_MINUTES", "10"))

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
RZ_BASE = "https://api.razorpay.com"

SUREPASS_BASE = os.environ.get("SUREPASS_BASE_URL", "https://kyc-api.surepass.io").rstrip("/")
SUREPASS_TOKEN = os.environ.get("SUREPASS_TOKEN", "")

META_VER = os.environ.get("META_GRAPH_VERSION", "v23.0")
META_PHONE_ID = os.environ.get("META_PHONE_NUMBER_ID", "")
META_TOKEN = os.environ.get("META_ACCESS_TOKEN", "")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
EMAIL_USERNAME = os.environ.get("EMAIL_USERNAME", "")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", EMAIL_USERNAME)
PUBLIC_APP_URL = os.environ.get("PUBLIC_APP_URL", "")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

scheduler = AsyncIOScheduler()


# ----------------------------- helpers -----------------------------
def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


def iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).isoformat()


def make_token(user: dict) -> str:
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "iat": now(),
        "exp": now() + timedelta(minutes=JWT_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def otp_digest(code: str) -> str:
    return hashlib.sha256(f"{JWT_SECRET}:{code}".encode()).hexdigest()


def public(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "name": user.get("name", ""),
        "phone": user.get("phone", ""),
        "email_verified": user.get("email_verified", False),
        "aadhaar_verified": user.get("aadhaar_verified", False),
        "has_bank": bool(user.get("razorpay_account_id")),
    }


async def send_email(to: str, subject: str, body: str):
    if not GMAIL_APP_PASSWORD:
        log.warning("SMTP not configured; skipping email to %s", to)
        return False
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        await aiosmtplib.send(
            msg, hostname=SMTP_HOST, port=SMTP_PORT,
            username=EMAIL_USERNAME, password=GMAIL_APP_PASSWORD.replace(" ", ""),
            start_tls=True,
        )
        return True
    except Exception as e:
        log.error("email send failed: %s", e)
        return False


async def notify(user_id: str, title: str, body: str, ntype: str = "info"):
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user_id, "title": title, "body": body,
        "type": ntype, "read": False, "created_at": iso(now()),
    })


# ----------------------------- WhatsApp -----------------------------
async def wa_send(to: str, template: str, tenant_name: str, amount: str,
                  month: str, due_date: str, pay_suffix: str) -> bool:
    if not (META_TOKEN and META_PHONE_ID) or "REPLACE" in META_TOKEN:
        log.info("WhatsApp not configured; would send %s to %s", template, to)
        return False
    if not to.startswith("+"):
        to = "+91" + to.lstrip("0")
    url = f"https://graph.facebook.com/{META_VER}/{META_PHONE_ID}/messages"
    body = {
        "messaging_product": "whatsapp", "recipient_type": "individual", "to": to,
        "type": "template",
        "template": {
            "name": template, "language": {"code": "en_IN"},
            "components": [
                {"type": "body", "parameters": [
                    {"type": "text", "parameter_name": "tenant_name", "text": tenant_name},
                    {"type": "text", "parameter_name": "amount", "text": amount},
                    {"type": "text", "parameter_name": "month", "text": month},
                    {"type": "text", "parameter_name": "due_date", "text": due_date},
                ]},
                {"type": "button", "sub_type": "url", "index": "0",
                 "parameters": [{"type": "text", "text": pay_suffix}]},
            ],
        },
    }
    try:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(url, headers={"Authorization": f"Bearer {META_TOKEN}"}, json=body)
        return not r.is_error
    except Exception as e:
        log.error("whatsapp send failed: %s", e)
        return False


# ----------------------------- Razorpay -----------------------------
async def rz_post(path: str, body: dict) -> dict:
    if not RAZORPAY_KEY_ID:
        raise HTTPException(503, "Razorpay not configured")
    async with httpx.AsyncClient(base_url=RZ_BASE, timeout=25) as c:
        r = await c.post(path, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET), json=body)
    if r.is_error:
        log.error("razorpay error %s: %s", r.status_code, r.text[:300])
        raise HTTPException(r.status_code, f"Razorpay: {r.text[:200]}")
    return r.json()


async def rz_patch(path: str, body: dict) -> dict:
    async with httpx.AsyncClient(base_url=RZ_BASE, timeout=25) as c:
        r = await c.patch(path, auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET), json=body)
    if r.is_error:
        raise HTTPException(r.status_code, f"Razorpay: {r.text[:200]}")
    return r.json()


# ----------------------------- auth deps -----------------------------
async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not cred or cred.scheme.lower() != "bearer":
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload.get("sub"), "deleted_at": None}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_role(role: str):
    async def check(user=Depends(current_user)):
        if user["role"] != role:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return check


# ----------------------------- schemas -----------------------------
class SignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Literal["owner", "tenant"]
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=8, max_length=15)


class VerifyIn(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class ResendIn(BaseModel):
    email: EmailStr


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AadhaarGenIn(BaseModel):
    aadhaar: str = Field(pattern=r"^\d{12}$")


class AadhaarVerifyIn(BaseModel):
    otp: str = Field(pattern=r"^\d{6}$")


class PropertyIn(BaseModel):
    name: str
    address: str
    city: str = ""


class UnitIn(BaseModel):
    name: str
    rent_amount: int = Field(gt=0)


class LeaseIn(BaseModel):
    unit_id: str
    tenant_email: EmailStr
    rent_amount: int = Field(gt=0)
    rent_due_day: int = Field(ge=1, le=28, default=1)
    security_deposit: int = Field(ge=0, default=0)
    start_date: str
    end_date: str


class BankIn(BaseModel):
    legal_business_name: str
    contact_name: str
    beneficiary_name: str
    ifsc_code: str
    account_number: str
    email: EmailStr
    phone: str
    city: str = "Mumbai"
    state: str = "Maharashtra"
    postal_code: str = "400001"
    street1: str = "NA"


class ExpenseIn(BaseModel):
    property_id: Optional[str] = None
    category: str
    amount: int = Field(gt=0)
    note: str = ""
    date: str


class TicketIn(BaseModel):
    property_id: str
    unit_id: Optional[str] = None
    title: str
    description: str = ""
    category: str = "General"
    priority: Literal["low", "medium", "high"] = "medium"


class TicketUpdate(BaseModel):
    status: Optional[Literal["open", "in_progress", "resolved"]] = None
    comment: Optional[str] = None


class DeductionIn(BaseModel):
    amount: int = Field(gt=0)
    reason: str


class RefundIn(BaseModel):
    amount: int = Field(ge=0)
    refund_date: str


class OrderIn(BaseModel):
    invoice_id: str


class VerifyPayIn(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


# ----------------------------- lifespan -----------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.users.create_index("email", unique=True)
    await db.rent_orders.create_index("razorpay_order_id")
    scheduler.add_job(daily_job, "cron", hour=9, minute=0, id="daily", replace_existing=True)
    scheduler.start()
    log.info("Rentify backend started")
    yield
    scheduler.shutdown(wait=False)
    client.close()


app = FastAPI(title="Rentify API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)

api = app.router  # routes are added with /api prefix below


# ----------------------------- AUTH -----------------------------
@app.get("/api/health")
async def health():
    return {"ok": True, "service": "rentify"}


@app.post("/api/auth/signup", status_code=202)
async def signup(body: SignupIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    code = f"{secrets.randbelow(1_000_000):06d}"
    uid = new_id()
    await db.users.insert_one({
        "id": uid, "email": email, "password_hash": pwd.hash(body.password),
        "role": body.role, "name": body.name, "phone": body.phone,
        "email_verified": False, "aadhaar_verified": False,
        "otp_hash": otp_digest(code), "otp_expires": iso(now() + timedelta(minutes=OTP_MINUTES)),
        "otp_attempts": 0, "created_at": iso(now()), "deleted_at": None,
    })
    await send_email(email, "Your Rentify verification code",
                     f"Hi {body.name}, your Rentify verification code is {code}. It expires in {OTP_MINUTES} minutes.")
    log.info("signup OTP for %s = %s", email, code)  # dev aid
    return {"message": "Verification code sent", "email": email}


@app.post("/api/auth/verify-email")
async def verify_email(body: VerifyIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or user.get("email_verified"):
        raise HTTPException(400, "Invalid or expired code")
    if user.get("otp_attempts", 0) >= 6:
        raise HTTPException(400, "Too many attempts. Request a new code.")
    expired = datetime.fromisoformat(user["otp_expires"]) < now()
    if expired or user.get("otp_hash") != otp_digest(body.otp):
        await db.users.update_one({"id": user["id"]}, {"$inc": {"otp_attempts": 1}})
        raise HTTPException(400, "Invalid or expired code")
    await db.users.update_one({"id": user["id"]}, {
        "$set": {"email_verified": True},
        "$unset": {"otp_hash": "", "otp_expires": "", "otp_attempts": ""},
    })
    user = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {"access_token": make_token(user), "user": public(user)}


@app.post("/api/auth/resend-otp")
async def resend_otp(body: ResendIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or user.get("email_verified"):
        raise HTTPException(400, "Nothing to verify")
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "otp_hash": otp_digest(code),
        "otp_expires": iso(now() + timedelta(minutes=OTP_MINUTES)), "otp_attempts": 0,
    }})
    await send_email(user["email"], "Your Rentify verification code",
                     f"Your new Rentify code is {code}.")
    log.info("resend OTP for %s = %s", user["email"], code)
    return {"message": "Verification code sent"}


@app.post("/api/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower(), "deleted_at": None})
    if not user or not pwd.verify(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    if not user.get("email_verified"):
        raise HTTPException(403, "Please verify your email first")
    return {"access_token": make_token(user), "user": public(user)}


@app.get("/api/auth/me")
async def me(user=Depends(current_user)):
    return public(user)


# ----------------------------- AADHAAR -----------------------------
@app.post("/api/aadhaar/generate-otp")
async def aadhaar_gen(body: AadhaarGenIn, user=Depends(current_user)):
    if not SUREPASS_TOKEN or "REPLACE" in SUREPASS_TOKEN:
        raise HTTPException(503, "Aadhaar verification is not configured yet. Add SUREPASS_TOKEN.")
    async with httpx.AsyncClient(base_url=SUREPASS_BASE, timeout=25) as c:
        r = await c.post("/api/v1/aadhaar-v2/generate-otp",
                         headers={"Authorization": f"Bearer {SUREPASS_TOKEN}"},
                         json={"id_number": body.aadhaar})
    data = r.json() if r.content else {}
    d = data.get("data") or {}
    req_id = data.get("request_id")
    if r.is_error or not d.get("otp_sent") or req_id is None:
        raise HTTPException(502, data.get("message", "Could not send Aadhaar OTP"))
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "aadhaar_last4": body.aadhaar[-4:], "aadhaar_request_id": req_id,
        "aadhaar_otp_at": iso(now()),
    }})
    return {"status": "otp_sent"}


@app.post("/api/aadhaar/verify-otp")
async def aadhaar_verify(body: AadhaarVerifyIn, user=Depends(current_user)):
    req_id = user.get("aadhaar_request_id")
    if not req_id:
        raise HTTPException(400, "Request an Aadhaar OTP first")
    async with httpx.AsyncClient(base_url=SUREPASS_BASE, timeout=25) as c:
        r = await c.post("/api/v1/aadhaar-v2/submit-otp",
                         headers={"Authorization": f"Bearer {SUREPASS_TOKEN}"},
                         json={"request_id": req_id, "otp": body.otp})
    data = r.json() if r.content else {}
    ok = (not r.is_error) and str(data.get("status", "")).lower() in {"success", "verified"}
    if not ok:
        raise HTTPException(400, data.get("message", "Aadhaar OTP verification failed"))
    pdata = data.get("data") or {}
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "aadhaar_verified": True, "aadhaar_name": pdata.get("full_name", ""),
        "aadhaar_verified_at": iso(now()),
    }, "$unset": {"aadhaar_request_id": ""}})
    return {"status": "verified"}


# ----------------------------- PROPERTIES / UNITS -----------------------------
@app.post("/api/properties")
async def create_property(body: PropertyIn, user=Depends(require_role("owner"))):
    doc = {"id": new_id(), "owner_id": user["id"], "name": body.name,
           "address": body.address, "city": body.city, "created_at": iso(now()), "deleted_at": None}
    await db.properties.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/properties")
async def list_properties(user=Depends(require_role("owner"))):
    props = await db.properties.find({"owner_id": user["id"], "deleted_at": None}, {"_id": 0}).to_list(500)
    for p in props:
        units = await db.units.find({"property_id": p["id"], "deleted_at": None}, {"_id": 0}).to_list(500)
        p["units"] = units
        p["unit_count"] = len(units)
        p["occupied"] = sum(1 for u in units if u["status"] == "occupied")
    return props


@app.get("/api/properties/{pid}")
async def get_property(pid: str, user=Depends(current_user)):
    p = await db.properties.find_one({"id": pid, "deleted_at": None}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Property not found")
    p["units"] = await db.units.find({"property_id": pid, "deleted_at": None}, {"_id": 0}).to_list(500)
    return p


@app.post("/api/properties/{pid}/units")
async def add_unit(pid: str, body: UnitIn, user=Depends(require_role("owner"))):
    prop = await db.properties.find_one({"id": pid, "owner_id": user["id"], "deleted_at": None})
    if not prop:
        raise HTTPException(404, "Property not found")
    doc = {"id": new_id(), "property_id": pid, "owner_id": user["id"], "name": body.name,
           "rent_amount": body.rent_amount, "status": "vacant",
           "created_at": iso(now()), "deleted_at": None}
    await db.units.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ----------------------------- LEASES / TENANTS -----------------------------
@app.post("/api/leases")
async def create_lease(body: LeaseIn, user=Depends(require_role("owner"))):
    unit = await db.units.find_one({"id": body.unit_id, "owner_id": user["id"], "deleted_at": None})
    if not unit:
        raise HTTPException(404, "Unit not found")
    if unit["status"] == "occupied":
        raise HTTPException(409, "Unit is already occupied")
    tenant = await db.users.find_one({"email": body.tenant_email.lower(), "role": "tenant", "deleted_at": None})
    if not tenant:
        raise HTTPException(404, "No tenant account with that email. Ask the tenant to sign up first.")
    lease = {
        "id": new_id(), "owner_id": user["id"], "unit_id": unit["id"],
        "property_id": unit["property_id"], "tenant_id": tenant["id"],
        "tenant_name": tenant["name"], "tenant_phone": tenant["phone"], "tenant_email": tenant["email"],
        "rent_amount": body.rent_amount, "rent_due_day": body.rent_due_day,
        "security_deposit": body.security_deposit, "start_date": body.start_date,
        "end_date": body.end_date, "status": "active", "created_at": iso(now()), "deleted_at": None,
    }
    await db.leases.insert_one(lease)
    await db.units.update_one({"id": unit["id"]}, {"$set": {"status": "occupied"}})
    if body.security_deposit > 0:
        await db.deposits.insert_one({
            "id": new_id(), "lease_id": lease["id"], "tenant_id": tenant["id"], "owner_id": user["id"],
            "amount": body.security_deposit, "status": "held", "deductions": [],
            "refund_amount": 0, "refund_date": None, "created_at": iso(now()),
        })
    # first invoice for current month
    await ensure_invoice(lease, month_key(now()))
    await notify(tenant["id"], "Welcome to your new home",
                 f"Your lease for {unit['name']} is active. Rent ₹{body.rent_amount}/mo.", "lease")
    lease.pop("_id", None)
    return lease


@app.get("/api/leases")
async def list_leases(user=Depends(current_user)):
    q = {"owner_id": user["id"]} if user["role"] == "owner" else {"tenant_id": user["id"]}
    q["deleted_at"] = None
    leases = await db.leases.find(q, {"_id": 0}).to_list(500)
    return leases


# ----------------------------- INVOICES / LEDGER -----------------------------
def month_key(d: datetime) -> str:
    return d.strftime("%Y-%m")


def month_label(mk: str) -> str:
    return datetime.strptime(mk, "%Y-%m").strftime("%B %Y")


async def ensure_invoice(lease: dict, mk: str) -> dict:
    existing = await db.invoices.find_one({"lease_id": lease["id"], "month": mk}, {"_id": 0})
    if existing:
        return existing
    y, m = map(int, mk.split("-"))
    due = date(y, m, min(lease["rent_due_day"], 28))
    doc = {
        "id": new_id(), "lease_id": lease["id"], "tenant_id": lease["tenant_id"],
        "owner_id": lease["owner_id"], "unit_id": lease["unit_id"], "property_id": lease["property_id"],
        "tenant_name": lease["tenant_name"], "tenant_phone": lease["tenant_phone"],
        "month": mk, "label": month_label(mk), "amount": lease["rent_amount"],
        "due_date": due.isoformat(), "status": "due", "paid_at": None,
        "payment_id": None, "razorpay_order_id": None,
        "reminders": {}, "created_at": iso(now()),
    }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.get("/api/invoices")
async def list_invoices(user=Depends(current_user)):
    q = {"owner_id": user["id"]} if user["role"] == "owner" else {"tenant_id": user["id"]}
    invs = await db.invoices.find(q, {"_id": 0}).sort("month", -1).to_list(500)
    return invs


@app.get("/api/tenant/ledger")
async def tenant_ledger(user=Depends(require_role("tenant"))):
    invs = await db.invoices.find({"tenant_id": user["id"]}, {"_id": 0}).sort("due_date", -1).to_list(500)
    entries = []
    for inv in invs:
        entries.append({
            "id": inv["id"], "type": "charge", "title": f"Rent · {inv['label']}",
            "date": inv["due_date"], "amount": inv["amount"], "status": inv["status"],
        })
        if inv["status"] == "paid" and inv.get("paid_at"):
            entries.append({
                "id": inv["id"] + "-p", "type": "payment", "title": f"Payment received · {inv['label']}",
                "date": inv["paid_at"][:10], "amount": inv["amount"], "status": "paid",
            })
    deposits = await db.deposits.find({"tenant_id": user["id"]}, {"_id": 0}).to_list(100)
    for d in deposits:
        entries.append({"id": d["id"], "type": "deposit", "title": "Security deposit",
                        "date": d["created_at"][:10], "amount": d["amount"], "status": d["status"]})
        for ded in d.get("deductions", []):
            entries.append({"id": new_id(), "type": "deduction",
                            "title": f"Deduction · {ded['reason']}", "date": ded["date"],
                            "amount": ded["amount"], "status": "deducted"})
        if d.get("refund_date"):
            entries.append({"id": d["id"] + "-r", "type": "refund", "title": "Deposit refunded",
                            "date": d["refund_date"], "amount": d.get("refund_amount", 0), "status": "refunded"})
    entries.sort(key=lambda e: e["date"], reverse=True)
    outstanding = sum(i["amount"] for i in invs if i["status"] in ("due", "overdue"))
    return {"outstanding": outstanding, "entries": entries}


# ----------------------------- DASHBOARDS -----------------------------
@app.get("/api/owner/dashboard")
async def owner_dashboard(user=Depends(require_role("owner"))):
    oid = user["id"]
    mk = month_key(now())
    today = now().date().isoformat()
    units = await db.units.find({"owner_id": oid, "deleted_at": None}, {"_id": 0}).to_list(1000)
    occupied = sum(1 for u in units if u["status"] == "occupied")
    vacant = len(units) - occupied

    invs = await db.invoices.find({"owner_id": oid}, {"_id": 0}).to_list(2000)
    revenue_month = sum(i["amount"] for i in invs if i["month"] == mk and i["status"] == "paid")
    pending_rent = sum(i["amount"] for i in invs if i["status"] in ("due", "overdue"))

    due_today = [i for i in invs if i["due_date"] == today and i["status"] in ("due", "overdue")]
    overdue = [i for i in invs if i["status"] == "overdue"]

    tickets_today = await db.tickets.count_documents(
        {"owner_id": oid, "status": {"$ne": "resolved"},
         "created_at": {"$regex": f"^{today}"}})
    open_tickets = await db.tickets.count_documents({"owner_id": oid, "status": {"$ne": "resolved"}})

    # agreements expiring this month
    leases = await db.leases.find({"owner_id": oid, "status": "active", "deleted_at": None}, {"_id": 0}).to_list(500)
    expiring = [l for l in leases if l["end_date"][:7] == mk]

    return {
        "revenue_month": revenue_month,
        "pending_rent": pending_rent,
        "occupied_units": occupied,
        "vacant_units": vacant,
        "total_units": len(units),
        "occupancy_pct": round(occupied / len(units) * 100) if units else 0,
        "today": {
            "due_today": len(due_today),
            "overdue": len(overdue),
            "overdue_amount": sum(i["amount"] for i in overdue),
            "maintenance_today": tickets_today,
            "open_tickets": open_tickets,
            "expiring_leases": len(expiring),
        },
        "expiring_list": expiring,
    }


@app.get("/api/owner/revenue-trend")
async def revenue_trend(user=Depends(require_role("owner"))):
    invs = await db.invoices.find({"owner_id": user["id"], "status": "paid"}, {"_id": 0}).to_list(3000)
    buckets: dict = {}
    for i in range(5, -1, -1):
        d = (now().replace(day=1) - timedelta(days=1)).replace(day=1)
        mk = (now() - timedelta(days=30 * i)).strftime("%Y-%m")
        buckets[mk] = 0
    for inv in invs:
        if inv["month"] in buckets:
            buckets[inv["month"]] += inv["amount"]
    return [{"month": datetime.strptime(k, "%Y-%m").strftime("%b"), "value": v}
            for k, v in buckets.items()]


@app.get("/api/tenant/dashboard")
async def tenant_dashboard(user=Depends(require_role("tenant"))):
    lease = await db.leases.find_one({"tenant_id": user["id"], "status": "active", "deleted_at": None}, {"_id": 0})
    invs = await db.invoices.find({"tenant_id": user["id"]}, {"_id": 0}).sort("due_date", 1).to_list(500)
    next_inv = next((i for i in invs if i["status"] in ("due", "overdue")), None)
    unpaid = [i for i in invs if i["status"] in ("due", "overdue")]
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    unit = None
    if lease:
        unit = await db.units.find_one({"id": lease["unit_id"]}, {"_id": 0})
    return {
        "lease": lease,
        "unit": unit,
        "next_invoice": next_inv,
        "outstanding": sum(i["amount"] for i in unpaid),
        "unpaid_count": len(unpaid),
        "unread_notifications": unread,
    }


# ----------------------------- PAYMENTS (Razorpay Route) -----------------------------
@app.post("/api/owner/bank")
async def create_bank(body: BankIn, user=Depends(require_role("owner"))):
    acc = await rz_post("/v2/accounts", {
        "email": body.email, "phone": body.phone, "type": "route",
        "reference_id": user["id"], "legal_business_name": body.legal_business_name,
        "business_type": "individual", "contact_name": body.contact_name,
        "profile": {"category": "real_estate", "subcategory": "property_management",
                    "addresses": {"registered": {
                        "street1": body.street1, "city": body.city, "state": body.state,
                        "postal_code": body.postal_code, "country": "IN"}}},
    })
    account_id = acc["id"]
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "razorpay_account_id": account_id, "bank_beneficiary": body.beneficiary_name,
        "bank_ifsc": body.ifsc_code, "bank_last4": body.account_number[-4:],
        "route_status": "created",
    }})
    return {"razorpay_account_id": account_id, "status": "created",
            "note": "Complete Route product activation & KYC on Razorpay before payouts settle."}


@app.post("/api/rent/orders")
async def create_order(body: OrderIn, user=Depends(require_role("tenant"))):
    inv = await db.invoices.find_one({"id": body.invoice_id, "tenant_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv["status"] == "paid":
        raise HTTPException(409, "Already paid")
    owner = await db.users.find_one({"id": inv["owner_id"]}, {"_id": 0})
    amount_paise = inv["amount"] * 100
    order_body = {
        "amount": amount_paise, "currency": "INR",
        "receipt": f"rent_{inv['id']}"[:40], "partial_payment": False,
        "notes": {"invoice_id": inv["id"], "tenant_id": user["id"]},
    }
    # Route split to owner's linked account when available
    if owner and owner.get("razorpay_account_id"):
        order_body["transfers"] = [{
            "account": owner["razorpay_account_id"], "amount": amount_paise, "currency": "INR",
            "notes": {"invoice_id": inv["id"]}, "on_hold": False,
        }]
    order = await rz_post("/v1/orders", order_body)
    await db.rent_orders.insert_one({
        "id": new_id(), "invoice_id": inv["id"], "tenant_id": user["id"], "owner_id": inv["owner_id"],
        "razorpay_order_id": order["id"], "amount": amount_paise, "status": "created",
        "created_at": iso(now()),
    })
    await db.invoices.update_one({"id": inv["id"]}, {"$set": {"razorpay_order_id": order["id"]}})
    return {"order_id": order["id"], "amount": amount_paise, "currency": "INR",
            "key_id": RAZORPAY_KEY_ID, "name": "Rentify",
            "description": f"Rent · {inv['label']}",
            "prefill": {"email": user["email"], "contact": user["phone"]}}


async def mark_invoice_paid(inv: dict, payment_id: Optional[str]):
    await db.invoices.update_one({"id": inv["id"]}, {"$set": {
        "status": "paid", "paid_at": iso(now()), "payment_id": payment_id}})
    await notify(inv["owner_id"], "Rent received",
                 f"₹{inv['amount']} received for {inv['label']} ({inv['tenant_name']}).", "payment")
    await notify(inv["tenant_id"], "Payment confirmed",
                 f"Your rent of ₹{inv['amount']} for {inv['label']} is paid. Thank you!", "payment")
    await wa_send(inv["tenant_phone"], "rent_payment_confirmed", inv["tenant_name"],
                  str(inv["amount"]), inv["label"], inv["due_date"], inv["id"])


@app.post("/api/payments/verify")
async def verify_payment(body: VerifyPayIn, user=Depends(require_role("tenant"))):
    order = await db.rent_orders.find_one({"razorpay_order_id": body.razorpay_order_id})
    if not order:
        raise HTTPException(404, "Unknown order")
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(400, "Invalid payment signature")
    await db.rent_orders.update_one({"id": order["id"]}, {"$set": {
        "status": "paid", "payment_id": body.razorpay_payment_id}})
    inv = await db.invoices.find_one({"id": order["invoice_id"]}, {"_id": 0})
    if inv and inv["status"] != "paid":
        await mark_invoice_paid(inv, body.razorpay_payment_id)
    return {"ok": True}


@app.post("/api/invoices/{iid}/mark-paid")
async def mark_paid_manual(iid: str, user=Depends(require_role("owner"))):
    inv = await db.invoices.find_one({"id": iid, "owner_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv["status"] == "paid":
        return {"ok": True}
    await mark_invoice_paid(inv, "manual-cash")
    return {"ok": True}


@app.post("/api/webhooks/razorpay")
async def razorpay_webhook(request: Request):
    raw = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")
    if RAZORPAY_WEBHOOK_SECRET and "change_this" not in RAZORPAY_WEBHOOK_SECRET:
        expected = hmac.new(RAZORPAY_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(400, "Invalid webhook signature")
    event = json.loads(raw or b"{}")
    name = event.get("event", "")
    if name in ("payment.captured", "order.paid"):
        entity = (event.get("payload", {}).get("payment", {}).get("entity", {})
                  or event.get("payload", {}).get("order", {}).get("entity", {}))
        order_id = entity.get("order_id") or entity.get("id")
        order = await db.rent_orders.find_one({"razorpay_order_id": order_id})
        if order:
            inv = await db.invoices.find_one({"id": order["invoice_id"]}, {"_id": 0})
            if inv and inv["status"] != "paid":
                await mark_invoice_paid(inv, entity.get("id"))
    return {"ok": True}


# ----------------------------- DEPOSITS -----------------------------
@app.get("/api/deposits")
async def list_deposits(user=Depends(current_user)):
    q = {"owner_id": user["id"]} if user["role"] == "owner" else {"tenant_id": user["id"]}
    deps = await db.deposits.find(q, {"_id": 0}).to_list(500)
    for d in deps:
        lease = await db.leases.find_one({"id": d["lease_id"]}, {"_id": 0})
        d["tenant_name"] = lease["tenant_name"] if lease else ""
        d["deducted_total"] = sum(x["amount"] for x in d.get("deductions", []))
    return deps


@app.post("/api/deposits/{did}/deduction")
async def add_deduction(did: str, body: DeductionIn, user=Depends(require_role("owner"))):
    dep = await db.deposits.find_one({"id": did, "owner_id": user["id"]}, {"_id": 0})
    if not dep:
        raise HTTPException(404, "Deposit not found")
    ded = {"amount": body.amount, "reason": body.reason, "date": now().date().isoformat()}
    await db.deposits.update_one({"id": did}, {"$push": {"deductions": ded}, "$set": {"status": "deducted"}})
    await notify(dep["tenant_id"], "Deposit deduction recorded",
                 f"₹{body.amount} deducted: {body.reason}", "deposit")
    return {"ok": True}


@app.post("/api/deposits/{did}/refund")
async def refund_deposit(did: str, body: RefundIn, user=Depends(require_role("owner"))):
    dep = await db.deposits.find_one({"id": did, "owner_id": user["id"]}, {"_id": 0})
    if not dep:
        raise HTTPException(404, "Deposit not found")
    await db.deposits.update_one({"id": did}, {"$set": {
        "status": "refunded", "refund_amount": body.amount, "refund_date": body.refund_date}})
    await notify(dep["tenant_id"], "Deposit refunded",
                 f"₹{body.amount} refunded on {body.refund_date}.", "deposit")
    return {"ok": True}


# ----------------------------- MAINTENANCE TICKETS -----------------------------
@app.get("/api/tickets")
async def list_tickets(status: Optional[str] = Query(None), user=Depends(current_user)):
    q = {"owner_id": user["id"]} if user["role"] == "owner" else {"tenant_id": user["id"]}
    if status:
        q["status"] = status
    tickets = await db.tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return tickets


@app.post("/api/tickets")
async def create_ticket(body: TicketIn, user=Depends(current_user)):
    prop = await db.properties.find_one({"id": body.property_id, "deleted_at": None}, {"_id": 0})
    if not prop:
        raise HTTPException(404, "Property not found")
    owner_id = prop["owner_id"]
    ticket = {
        "id": new_id(), "ticket_no": f"TKT-{secrets.randbelow(100000):05d}",
        "property_id": body.property_id, "property_name": prop["name"], "unit_id": body.unit_id,
        "owner_id": owner_id, "tenant_id": user["id"] if user["role"] == "tenant" else None,
        "raised_by": user["name"], "raised_by_role": user["role"],
        "title": body.title, "description": body.description, "category": body.category,
        "priority": body.priority, "status": "open",
        "comments": [], "created_at": iso(now()), "updated_at": iso(now()),
    }
    await db.tickets.insert_one(ticket)
    await notify(owner_id, "New maintenance request",
                 f"{ticket['ticket_no']}: {body.title} ({body.priority})", "maintenance")
    ticket.pop("_id", None)
    return ticket


@app.get("/api/tickets/{tid}")
async def get_ticket(tid: str, user=Depends(current_user)):
    t = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not t or (user["role"] == "owner" and t["owner_id"] != user["id"]) or \
       (user["role"] == "tenant" and t["tenant_id"] != user["id"]):
        raise HTTPException(404, "Ticket not found")
    return t


@app.patch("/api/tickets/{tid}")
async def update_ticket(tid: str, body: TicketUpdate, user=Depends(current_user)):
    t = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket not found")
    if user["role"] == "owner" and t["owner_id"] != user["id"]:
        raise HTTPException(403, "Not allowed")
    if user["role"] == "tenant" and t["tenant_id"] != user["id"]:
        raise HTTPException(403, "Not allowed")
    upd = {"updated_at": iso(now())}
    if body.status:
        upd["status"] = body.status
    push = None
    if body.comment:
        push = {"comments": {"by": user["name"], "role": user["role"],
                             "text": body.comment, "at": iso(now())}}
    ops = {"$set": upd}
    if push:
        ops["$push"] = push
    await db.tickets.update_one({"id": tid}, ops)
    if body.status:
        target = t["tenant_id"] if user["role"] == "owner" else t["owner_id"]
        if target:
            await notify(target, f"Ticket {t['ticket_no']} · {body.status.replace('_', ' ')}",
                         t["title"], "maintenance")
    return await db.tickets.find_one({"id": tid}, {"_id": 0})


# ----------------------------- EXPENSES -----------------------------
@app.get("/api/expenses")
async def list_expenses(user=Depends(require_role("owner"))):
    exps = await db.expenses.find({"owner_id": user["id"], "deleted_at": None}, {"_id": 0}).sort("date", -1).to_list(500)
    total = sum(e["amount"] for e in exps)
    mk = month_key(now())
    month_total = sum(e["amount"] for e in exps if e["date"][:7] == mk)
    return {"total": total, "month_total": month_total, "expenses": exps}


@app.post("/api/expenses")
async def add_expense(body: ExpenseIn, user=Depends(require_role("owner"))):
    doc = {"id": new_id(), "owner_id": user["id"], "property_id": body.property_id,
           "category": body.category, "amount": body.amount, "note": body.note,
           "date": body.date, "created_at": iso(now()), "deleted_at": None}
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.delete("/api/expenses/{eid}")
async def delete_expense(eid: str, user=Depends(require_role("owner"))):
    await db.expenses.update_one({"id": eid, "owner_id": user["id"]},
                                 {"$set": {"deleted_at": iso(now())}})
    return {"ok": True}


# ----------------------------- NOTIFICATIONS -----------------------------
@app.get("/api/notifications")
async def list_notifications(user=Depends(current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    unread = sum(1 for n in items if not n["read"])
    return {"unread": unread, "items": items}


@app.post("/api/notifications/{nid}/read")
async def read_notification(nid: str, user=Depends(current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@app.post("/api/notifications/read-all")
async def read_all(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@app.post("/api/invoices/{iid}/send-reminder")
async def send_reminder(iid: str, user=Depends(require_role("owner"))):
    inv = await db.invoices.find_one({"id": iid, "owner_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    sent = await wa_send(inv["tenant_phone"], "rent_due_today", inv["tenant_name"],
                         str(inv["amount"]), inv["label"], inv["due_date"], inv["id"])
    await notify(inv["tenant_id"], "Rent reminder",
                 f"Reminder: ₹{inv['amount']} rent for {inv['label']} due {inv['due_date']}.", "rent")
    return {"whatsapp_sent": sent, "in_app": True}


# ----------------------------- CRON DAILY JOB -----------------------------
async def daily_job():
    log.info("daily_job running")
    today = now().date()
    tmk = month_key(now())
    # 1. generate current-month invoices for all active leases
    leases = await db.leases.find({"status": "active", "deleted_at": None}, {"_id": 0}).to_list(2000)
    for lease in leases:
        await ensure_invoice(lease, tmk)
    # 2. process invoices: overdue + reminders
    invs = await db.invoices.find({"status": {"$in": ["due", "overdue"]}}, {"_id": 0}).to_list(5000)
    for inv in invs:
        due = date.fromisoformat(inv["due_date"])
        rem = inv.get("reminders", {})
        delta = (due - today).days
        stage = None
        if delta == 3:
            stage = "rent_due_3_days"
        elif delta == 0:
            stage = "rent_due_today"
        elif delta < 0:
            stage = "rent_overdue"
            if inv["status"] != "overdue":
                await db.invoices.update_one({"id": inv["id"]}, {"$set": {"status": "overdue"}})
        if stage and not rem.get(stage):
            await wa_send(inv["tenant_phone"], stage, inv["tenant_name"], str(inv["amount"]),
                          inv["label"], inv["due_date"], inv["id"])
            msg = {"rent_due_3_days": f"Your rent ₹{inv['amount']} for {inv['label']} is due in 3 days.",
                   "rent_due_today": f"Your rent ₹{inv['amount']} for {inv['label']} is due today.",
                   "rent_overdue": f"Your rent ₹{inv['amount']} for {inv['label']} is overdue."}[stage]
            await notify(inv["tenant_id"], "Rent reminder", msg, "rent")
            await db.invoices.update_one({"id": inv["id"]}, {"$set": {f"reminders.{stage}": iso(now())}})


@app.post("/api/dev/run-daily")
async def run_daily(user=Depends(current_user)):
    await daily_job()
    return {"ok": True}
