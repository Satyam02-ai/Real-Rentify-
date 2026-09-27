# Rentify — Test Credentials

Backend base URL (external): use `EXPO_PUBLIC_BACKEND_URL` from /app/frontend/.env, append `/api`.
Local backend: http://localhost:8001/api

## Verified accounts (email already verified, ready to log in)
| Role   | Email             | Password | Notes |
|--------|-------------------|----------|-------|
| Owner  | owner1@test.com   | pass123  | Owns "Sunrise Apartments" (Flat 101 occupied) |
| Tenant | tenant1@test.com  | pass123  | Active lease, rent ₹8500 due, ₹20000 deposit held |

## Email OTP (signup / email verification)
- Emails are sent via Gmail SMTP, but the 6-digit OTP is ALSO written to the backend log for testing.
- To read the latest signup/resend OTP for an email:
  `grep "OTP for <email>" /var/log/supervisor/backend.err.log | tail -1`
- OTP endpoints: POST /api/auth/signup -> POST /api/auth/verify-email {email, otp}

## Integrations requiring real keys (cannot fully verify in preview)
- Aadhaar (Surepass): needs SUREPASS_TOKEN in /app/backend/.env (placeholder now -> returns 503).
- WhatsApp (Meta Cloud API): needs META_* keys (placeholder now -> reminders still create in-app notifications).
- Razorpay: LIVE keys present. Order creation works; do NOT complete real card payments in tests.
  Use POST /api/invoices/{id}/mark-paid (owner) to simulate a paid invoice instead.
