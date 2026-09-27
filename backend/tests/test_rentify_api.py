"""Rentify backend regression suite - covers auth, dashboards, leases, invoices,
deposits, tickets, expenses, notifications, Razorpay & Aadhaar smoke."""
import os
import subprocess
import time
import uuid
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/") + "/api" if False else None
# imported through conftest
from conftest import BASE  # noqa: E402


# ---------- Health ----------
def test_health():
    r = requests.get(f"{BASE}/health", timeout=10)
    assert r.status_code == 200 and r.json().get("ok") is True


# ---------- Auth ----------
class TestAuth:
    def test_login_owner(self):
        r = requests.post(f"{BASE}/auth/login",
                          json={"email": "owner1@test.com", "password": "pass123"})
        assert r.status_code == 200
        j = r.json()
        assert "access_token" in j and j["user"]["role"] == "owner"
        assert j["user"]["email_verified"] is True

    def test_login_tenant(self):
        r = requests.post(f"{BASE}/auth/login",
                          json={"email": "tenant1@test.com", "password": "pass123"})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "tenant"

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE}/auth/login",
                          json={"email": "owner1@test.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, owner_h):
        r = requests.get(f"{BASE}/auth/me", headers=owner_h)
        assert r.status_code == 200 and r.json()["role"] == "owner"

    def test_signup_verify_login_flow_and_403_before_verify(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        # signup
        r = requests.post(f"{BASE}/auth/signup", json={
            "email": email, "password": "pass1234", "role": "tenant",
            "name": "Test User", "phone": "9999999999"})
        assert r.status_code == 202, r.text
        # login before verify -> 403
        r2 = requests.post(f"{BASE}/auth/login",
                           json={"email": email, "password": "pass1234"})
        assert r2.status_code == 403
        # read OTP from log
        time.sleep(0.5)
        out = subprocess.check_output(
            ["grep", f"OTP for {email}", "/var/log/supervisor/backend.err.log"],
            stderr=subprocess.STDOUT).decode()
        otp = out.strip().split("=")[-1].strip()
        assert len(otp) == 6
        # verify
        r3 = requests.post(f"{BASE}/auth/verify-email",
                           json={"email": email, "otp": otp})
        assert r3.status_code == 200, r3.text
        assert "access_token" in r3.json()
        # login after verify
        r4 = requests.post(f"{BASE}/auth/login",
                           json={"email": email, "password": "pass1234"})
        assert r4.status_code == 200

    def test_signup_duplicate(self):
        r = requests.post(f"{BASE}/auth/signup", json={
            "email": "owner1@test.com", "password": "pass123", "role": "owner",
            "name": "x", "phone": "1234567890"})
        assert r.status_code == 409


# ---------- Owner Dashboard ----------
class TestOwnerDashboard:
    def test_dashboard_shape(self, owner_h):
        r = requests.get(f"{BASE}/owner/dashboard", headers=owner_h)
        assert r.status_code == 200
        j = r.json()
        for k in ("revenue_month", "pending_rent", "occupied_units",
                  "vacant_units", "occupancy_pct", "today"):
            assert k in j
        for k in ("due_today", "overdue", "open_tickets", "expiring_leases"):
            assert k in j["today"]

    def test_revenue_trend(self, owner_h):
        r = requests.get(f"{BASE}/owner/revenue-trend", headers=owner_h)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 6
        for b in data:
            assert "month" in b and "value" in b

    def test_dashboard_forbidden_for_tenant(self, tenant_h):
        r = requests.get(f"{BASE}/owner/dashboard", headers=tenant_h)
        assert r.status_code == 403


# ---------- Properties/Units ----------
class TestProperties:
    def test_list_properties(self, owner_h):
        r = requests.get(f"{BASE}/properties", headers=owner_h)
        assert r.status_code == 200
        props = r.json()
        assert isinstance(props, list) and len(props) >= 1
        p = props[0]
        assert "unit_count" in p and "occupied" in p and "units" in p

    def test_create_property_and_unit(self, owner_h):
        pr = requests.post(f"{BASE}/properties", headers=owner_h,
                           json={"name": "TEST_Prop", "address": "1 Test St", "city": "Pune"})
        assert pr.status_code == 200
        pid = pr.json()["id"]
        ur = requests.post(f"{BASE}/properties/{pid}/units", headers=owner_h,
                           json={"name": "Flat T1", "rent_amount": 5000})
        assert ur.status_code == 200
        assert ur.json()["status"] == "vacant"
        # GET verifies persistence
        g = requests.get(f"{BASE}/properties/{pid}", headers=owner_h)
        assert g.status_code == 200 and len(g.json()["units"]) == 1


# ---------- Leases ----------
class TestLeases:
    def test_lease_unit_occupied_conflict(self, owner_h):
        # find an occupied unit belonging to owner
        props = requests.get(f"{BASE}/properties", headers=owner_h).json()
        occ_unit = None
        for p in props:
            for u in p["units"]:
                if u["status"] == "occupied":
                    occ_unit = u
                    break
        assert occ_unit, "Need at least one occupied unit"
        r = requests.post(f"{BASE}/leases", headers=owner_h, json={
            "unit_id": occ_unit["id"], "tenant_email": "tenant1@test.com",
            "rent_amount": 5000, "rent_due_day": 5, "security_deposit": 10000,
            "start_date": "2026-01-01", "end_date": "2027-01-01"})
        assert r.status_code == 409

    def test_lease_tenant_not_found(self, owner_h):
        # need a vacant unit
        pr = requests.post(f"{BASE}/properties", headers=owner_h,
                           json={"name": "TEST_Lease", "address": "x", "city": "y"}).json()
        u = requests.post(f"{BASE}/properties/{pr['id']}/units", headers=owner_h,
                          json={"name": "V", "rent_amount": 4000}).json()
        r = requests.post(f"{BASE}/leases", headers=owner_h, json={
            "unit_id": u["id"], "tenant_email": "ghost_none@nowhere.com",
            "rent_amount": 4000, "rent_due_day": 1, "security_deposit": 0,
            "start_date": "2026-01-01", "end_date": "2026-12-01"})
        assert r.status_code == 404


# ---------- Invoices / Ledger ----------
class TestInvoicesLedger:
    def test_list_invoices_owner(self, owner_h):
        r = requests.get(f"{BASE}/invoices", headers=owner_h)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_tenant_ledger(self, tenant_h):
        r = requests.get(f"{BASE}/tenant/ledger", headers=tenant_h)
        assert r.status_code == 200
        j = r.json()
        assert "outstanding" in j and "entries" in j
        # deposit + charge entries expected
        types = {e["type"] for e in j["entries"]}
        assert "charge" in types or "deposit" in types

    def test_send_reminder(self, owner_h):
        invs = requests.get(f"{BASE}/invoices", headers=owner_h).json()
        due = next((i for i in invs if i["status"] in ("due", "overdue")), None)
        if not due:
            import pytest
            pytest.skip("No due invoices to remind")
        r = requests.post(f"{BASE}/invoices/{due['id']}/send-reminder", headers=owner_h)
        assert r.status_code == 200
        assert r.json()["in_app"] is True


# ---------- Tenant Dashboard ----------
class TestTenantDashboard:
    def test_dashboard(self, tenant_h):
        r = requests.get(f"{BASE}/tenant/dashboard", headers=tenant_h)
        assert r.status_code == 200
        j = r.json()
        for k in ("lease", "unit", "next_invoice", "outstanding", "unread_notifications"):
            assert k in j
        assert j["lease"] is not None
        assert j["unit"] is not None


# ---------- Deposits ----------
class TestDeposits:
    def test_deposits_list(self, owner_h):
        r = requests.get(f"{BASE}/deposits", headers=owner_h)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_deduction_flow(self, owner_h):
        deps = requests.get(f"{BASE}/deposits", headers=owner_h).json()
        if not deps:
            import pytest
            pytest.skip("No deposits")
        did = deps[0]["id"]
        r = requests.post(f"{BASE}/deposits/{did}/deduction", headers=owner_h,
                          json={"amount": 100, "reason": "TEST_damage"})
        assert r.status_code == 200
        # verify persisted
        deps2 = requests.get(f"{BASE}/deposits", headers=owner_h).json()
        d = next(x for x in deps2 if x["id"] == did)
        assert any(dd["reason"] == "TEST_damage" for dd in d["deductions"])


# ---------- Tickets ----------
class TestTickets:
    def test_tenant_creates_and_owner_updates(self, tenant_h, owner_h):
        props = requests.get(f"{BASE}/properties", headers=owner_h).json()
        pid = props[0]["id"]
        r = requests.post(f"{BASE}/tickets", headers=tenant_h, json={
            "property_id": pid, "title": "TEST_leak", "description": "d",
            "category": "Plumbing", "priority": "high"})
        assert r.status_code == 200
        tid = r.json()["id"]
        assert r.json()["status"] == "open"
        # owner sees
        lst = requests.get(f"{BASE}/tickets", headers=owner_h).json()
        assert any(t["id"] == tid for t in lst)
        # filter by status
        lst2 = requests.get(f"{BASE}/tickets?status=open", headers=owner_h).json()
        assert all(t["status"] == "open" for t in lst2)
        # update
        u = requests.patch(f"{BASE}/tickets/{tid}", headers=owner_h,
                           json={"status": "in_progress", "comment": "Looking"})
        assert u.status_code == 200
        got = requests.get(f"{BASE}/tickets/{tid}", headers=owner_h).json()
        assert got["status"] == "in_progress"
        assert len(got["comments"]) == 1


# ---------- Expenses ----------
class TestExpenses:
    def test_expense_crud(self, owner_h):
        r = requests.post(f"{BASE}/expenses", headers=owner_h, json={
            "category": "Repairs", "amount": 500, "note": "TEST", "date": "2026-01-05"})
        assert r.status_code == 200
        eid = r.json()["id"]
        lst = requests.get(f"{BASE}/expenses", headers=owner_h).json()
        assert "total" in lst and "month_total" in lst
        assert any(e["id"] == eid for e in lst["expenses"])
        d = requests.delete(f"{BASE}/expenses/{eid}", headers=owner_h)
        assert d.status_code == 200
        lst2 = requests.get(f"{BASE}/expenses", headers=owner_h).json()
        assert not any(e["id"] == eid for e in lst2["expenses"])


# ---------- Notifications ----------
class TestNotifications:
    def test_read_all(self, tenant_h):
        r = requests.get(f"{BASE}/notifications", headers=tenant_h)
        assert r.status_code == 200
        j = r.json()
        assert "unread" in j and "items" in j
        r2 = requests.post(f"{BASE}/notifications/read-all", headers=tenant_h)
        assert r2.status_code == 200
        j3 = requests.get(f"{BASE}/notifications", headers=tenant_h).json()
        assert j3["unread"] == 0


# ---------- Razorpay & Payment verify ----------
class TestPayments:
    def test_create_order_and_bogus_verify(self, tenant_h):
        dash = requests.get(f"{BASE}/tenant/dashboard", headers=tenant_h).json()
        inv = dash.get("next_invoice")
        if not inv:
            import pytest
            pytest.skip("No due invoice")
        r = requests.post(f"{BASE}/rent/orders", headers=tenant_h,
                          json={"invoice_id": inv["id"]})
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("order_id", "amount", "currency", "key_id"):
            assert k in j
        # bogus signature -> 400
        v = requests.post(f"{BASE}/payments/verify", headers=tenant_h, json={
            "razorpay_payment_id": "pay_fake", "razorpay_order_id": j["order_id"],
            "razorpay_signature": "deadbeef"})
        assert v.status_code == 400


# ---------- Aadhaar ----------
class TestAadhaar:
    def test_generate_otp_503(self, tenant_h):
        r = requests.post(f"{BASE}/aadhaar/generate-otp", headers=tenant_h,
                          json={"aadhaar": "123456789012"})
        assert r.status_code == 503


# ---------- Owner mark-paid + verify tenant ledger updates ----------
class TestMarkPaid:
    def test_owner_mark_paid_then_ledger(self, owner_h, tenant_h):
        invs = requests.get(f"{BASE}/invoices", headers=owner_h).json()
        due = next((i for i in invs if i["status"] in ("due", "overdue")
                    and i["tenant_id"]), None)
        if not due:
            import pytest
            pytest.skip("No due invoice")
        r = requests.post(f"{BASE}/invoices/{due['id']}/mark-paid", headers=owner_h)
        assert r.status_code == 200
        invs2 = requests.get(f"{BASE}/invoices", headers=owner_h).json()
        rec = next(i for i in invs2 if i["id"] == due["id"])
        assert rec["status"] == "paid"
