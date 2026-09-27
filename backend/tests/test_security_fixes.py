"""Security fix regression tests: SEC-002 (webhook signature),
SEC-003 (BOLA on property read + ticket scoping), SEC-004 (OTP hardening),
dev route gating."""
import os
import subprocess
import time
import uuid
import requests
import pytest

from conftest import BASE


def _signup_verify(role: str) -> dict:
    """Create a fresh user, verify via OTP from log, return {token, id, email}."""
    email = f"sec_{role}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE}/auth/signup", json={
        "email": email, "password": "pass1234", "role": role,
        "name": f"Sec {role}", "phone": "9000000000"})
    assert r.status_code == 202, r.text
    time.sleep(0.4)
    out = subprocess.check_output(
        ["grep", f"OTP for {email}", "/var/log/supervisor/backend.err.log"],
        stderr=subprocess.STDOUT).decode()
    otp = out.strip().split("\n")[-1].split("=")[-1].strip()
    assert len(otp) == 6
    v = requests.post(f"{BASE}/auth/verify-email",
                      json={"email": email, "otp": otp})
    assert v.status_code == 200, v.text
    j = v.json()
    return {"token": j["access_token"], "id": j["user"]["id"], "email": email}


# ---------- SEC-003: BOLA on GET /api/properties/{pid} ----------
class TestPropertyBOLA:
    def test_property_read_scoping(self, tenant_h):
        owner_a = _signup_verify("owner")
        owner_b = _signup_verify("owner")
        ha = {"Authorization": f"Bearer {owner_a['token']}"}
        hb = {"Authorization": f"Bearer {owner_b['token']}"}

        # A creates a property
        pr = requests.post(f"{BASE}/properties", headers=ha,
                           json={"name": "TEST_SEC_A", "address": "1", "city": "P"})
        assert pr.status_code == 200
        pid = pr.json()["id"]

        # Owner A can read -> 200
        r_a = requests.get(f"{BASE}/properties/{pid}", headers=ha)
        assert r_a.status_code == 200, r_a.text
        assert r_a.json()["id"] == pid

        # Owner B cannot read -> 404
        r_b = requests.get(f"{BASE}/properties/{pid}", headers=hb)
        assert r_b.status_code == 404, f"Expected 404, got {r_b.status_code}: {r_b.text}"

        # A tenant without active lease on that property -> 404
        r_t = requests.get(f"{BASE}/properties/{pid}", headers=tenant_h)
        assert r_t.status_code == 404, f"Expected 404, got {r_t.status_code}: {r_t.text}"

    def test_tenant_with_lease_can_read_own_property(self, tenant_h, owner_h):
        # tenant1 has an active lease on owner1's Sunrise Apartments
        dash = requests.get(f"{BASE}/tenant/dashboard", headers=tenant_h).json()
        lease = dash.get("lease")
        assert lease, "tenant1 should have an active lease"
        pid = lease["property_id"]
        r = requests.get(f"{BASE}/properties/{pid}", headers=tenant_h)
        assert r.status_code == 200, r.text
        assert r.json()["id"] == pid


# ---------- SEC-003: Ticket scoping ----------
class TestTicketScoping:
    def test_tenant_without_lease_cannot_ticket_property(self, owner_h):
        # Create a new isolated property owned by owner1 (no tenant lease on it)
        # Then have a freshly created tenant (no lease anywhere) try to ticket owner1's Sunrise
        # Use owner1's existing "Sunrise Apartments" too.
        props = requests.get(f"{BASE}/properties", headers=owner_h).json()
        assert props, "owner1 should have at least one property"
        pid = props[0]["id"]

        new_tenant = _signup_verify("tenant")
        ht = {"Authorization": f"Bearer {new_tenant['token']}"}
        r = requests.post(f"{BASE}/tickets", headers=ht, json={
            "property_id": pid, "title": "TEST_SEC_bad", "description": "d",
            "category": "Plumbing", "priority": "low"})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_owner_cannot_ticket_others_property(self, owner_h):
        # Create owner_b, then have owner_b try to ticket owner1's property
        owner_b = _signup_verify("owner")
        hb = {"Authorization": f"Bearer {owner_b['token']}"}
        props = requests.get(f"{BASE}/properties", headers=owner_h).json()
        pid = props[0]["id"]
        r = requests.post(f"{BASE}/tickets", headers=hb, json={
            "property_id": pid, "title": "TEST_SEC_owner_bad", "description": "d",
            "category": "Other", "priority": "low"})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    def test_legit_tenant_can_still_create_ticket(self, tenant_h, owner_h):
        props = requests.get(f"{BASE}/properties", headers=owner_h).json()
        pid = props[0]["id"]
        r = requests.post(f"{BASE}/tickets", headers=tenant_h, json={
            "property_id": pid, "title": "TEST_SEC_legit", "description": "leak",
            "category": "Plumbing", "priority": "medium"})
        assert r.status_code == 200, r.text


# ---------- SEC-002: Webhook signature ----------
class TestWebhookSignature:
    def test_webhook_no_signature_does_not_mark_paid(self, owner_h, tenant_h):
        # Snapshot an invoice
        invs = requests.get(f"{BASE}/invoices", headers=owner_h).json()
        due = next((i for i in invs if i["status"] in ("due", "overdue")), None)
        if not due:
            pytest.skip("No due invoice to guard")
        prev_status = due["status"]
        order_id = "order_test_" + uuid.uuid4().hex[:6]
        payload = {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"id": "pay_x", "order_id": order_id}}}
        }
        # 1) no signature header
        r1 = requests.post(f"{BASE}/webhooks/razorpay", json=payload)
        assert r1.status_code in (503, 400), r1.status_code
        # 2) invalid signature
        r2 = requests.post(f"{BASE}/webhooks/razorpay",
                           json=payload, headers={"x-razorpay-signature": "deadbeef"})
        assert r2.status_code in (503, 400), r2.status_code
        # invoice status unchanged
        invs2 = requests.get(f"{BASE}/invoices", headers=owner_h).json()
        rec = next(i for i in invs2 if i["id"] == due["id"])
        assert rec["status"] == prev_status, "Invoice status must not change without valid webhook signature"

    def test_webhook_never_returns_ok_without_valid_sig(self):
        # In preview the secret is a placeholder ("change_this..."), so should be 503
        r = requests.post(f"{BASE}/webhooks/razorpay",
                          json={"event": "payment.captured"},
                          headers={"x-razorpay-signature": "abc"})
        assert r.status_code != 200
        assert r.status_code in (503, 400)


# ---------- SEC-004: OTP hardening ----------
class TestOTPHardening:
    def test_resend_otp_rate_limits(self):
        # signup then hammer resend-otp
        email = f"otp_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE}/auth/signup", json={
            "email": email, "password": "pass1234", "role": "tenant",
            "name": "OTP test", "phone": "9000000000"})
        assert r.status_code == 202
        got_429 = False
        codes = []
        # Call resend 8 times rapidly
        for _ in range(8):
            r = requests.post(f"{BASE}/auth/resend-otp", json={"email": email})
            codes.append(r.status_code)
            if r.status_code == 429:
                got_429 = True
                break
        assert got_429, f"Expected 429 rate-limit; saw codes: {codes}"

    def test_verify_email_lockout_not_reset_by_resend(self):
        # Signup fresh user
        email = f"lock_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE}/auth/signup", json={
            "email": email, "password": "pass1234", "role": "tenant",
            "name": "Lock test", "phone": "9000000000"})
        assert r.status_code == 202
        # 6 wrong verify attempts -> should lock (Too many attempts)
        last = None
        for _ in range(6):
            last = requests.post(f"{BASE}/auth/verify-email",
                                 json={"email": email, "otp": "000000"})
            assert last.status_code == 400
        # 7th should still be 400 with lock message; try any (even correct) code -> 400
        r7 = requests.post(f"{BASE}/auth/verify-email",
                           json={"email": email, "otp": "000000"})
        assert r7.status_code == 400
        # Now request a resend (should succeed, but must NOT reset the attempt counter)
        rr = requests.post(f"{BASE}/auth/resend-otp", json={"email": email})
        # Could be 200 or 429 (if we already hit resend limit); either way ok
        assert rr.status_code in (200, 429)
        # After resend, get the NEW correct OTP from log and try to verify -> must still be locked (400 Too many attempts)
        time.sleep(0.3)
        try:
            out = subprocess.check_output(
                ["grep", f"OTP for {email}", "/var/log/supervisor/backend.err.log"],
                stderr=subprocess.STDOUT).decode()
            otp = out.strip().split("\n")[-1].split("=")[-1].strip()
        except subprocess.CalledProcessError:
            otp = None
        if otp:
            v = requests.post(f"{BASE}/auth/verify-email",
                              json={"email": email, "otp": otp})
            # If lockout persists (fix is applied), we still get 400
            assert v.status_code == 400, (
                f"Verify succeeded ({v.status_code}) after resend - resend should NOT reset attempt counter: {v.text}")


# ---------- Dev route gating ----------
class TestDevRoute:
    def test_run_daily_ok_in_preview(self, owner_h):
        r = requests.post(f"{BASE}/dev/run-daily", headers=owner_h)
        # ENABLE_DEV_ROUTES=true in preview -> 200
        assert r.status_code == 200
        assert r.json().get("ok") is True
