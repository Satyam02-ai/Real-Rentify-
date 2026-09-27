# Rentify — Product Requirements & Progress

## Original problem statement
Rentify property management app. Add: Owner monthly revenue & occupancy; tenant important notifications; owner home dashboard (Revenue this month, Pending Rent, Occupied/Vacant units + Today's Actions: rents due today, overdue, maintenance today, agreements expiring this month); tenant ledger; automatic WhatsApp rent reminders (3 days before, due date, overdue, payment confirmation) with pay link; tenant signup email + Aadhaar verification; security deposit management (deposit/refund/deduction/reason/refund date); maintenance requests as a ticketing system; owner expense management panel; auto-settlement of rent to each owner's bank account via Razorpay.

## Architecture (rebuilt in Expo + FastAPI + MongoDB)
- Frontend: Expo Router (SDK 57), React Query, react-native-keyboard-controller, @react-native-vector-icons/material-design-icons. Theme in src/theme.ts (moss-green/sand, light+dark).
- Backend: FastAPI (server.py) + Motor (MongoDB local). JWT auth (bcrypt). APScheduler daily cron (invoice generation + reminders). httpx for Razorpay/Surepass/WhatsApp. aiosmtplib for email OTP.
- Two role experiences: Owner tabs (Home/Properties/Finances/More) & Tenant tabs (Home/Ledger/Requests/Alerts).

## User personas
- Property Owner: manages properties/units, tenants, rent collection, expenses, deposits, maintenance.
- Tenant: pays rent, views ledger, raises maintenance tickets, receives notifications.

## Core requirements (static)
Auth (owner+tenant, email OTP + Aadhaar), properties/units, leases, rent invoices+ledger, Razorpay Route payments, dashboards, security deposits, maintenance tickets, expenses, notifications, WhatsApp reminders.

## Implemented (2026-06)
- [x] Auth: signup/login, email OTP verification, JWT. Role-based routing.
- [x] Aadhaar verification flow (Surepass) — needs SUREPASS_TOKEN.
- [x] Owner dashboard: revenue this month, pending rent, occupied/vacant, occupancy %, Today's Actions.
- [x] Properties + units CRUD; assign tenant (lease) with deposit -> auto first invoice.
- [x] Finances: revenue trend bars, rent invoices (mark paid / send reminder), expenses.
- [x] Tenant dashboard: rent-due card + Pay Now, lease info, quick actions, KYC chip.
- [x] Tenant ledger (charges, payments, deposit, deductions, refunds) + outstanding balance.
- [x] Security deposits: track deposit, deductions (reason/date), refund (amount/date).
- [x] Maintenance ticketing: create, filter by status, status updates, comments/activity.
- [x] Expense management panel (categories, month/all-time totals).
- [x] In-app notifications center (owner + tenant), read/read-all.
- [x] Razorpay Route: owner bank linked account, order with transfer split, signature verify + webhook.
- [x] WhatsApp reminders via cron (3-day/due/overdue/confirmation) — needs META keys; in-app fallback works.

## Backlog / remaining
- P1: Real WhatsApp templates approval + META keys; Surepass token wiring; Razorpay Route KYC activation.
- P1: Property/ticket photo uploads (Object Storage) — deferred.
- P2: Lease renewal reminders, multi-owner reporting export, tenant document vault.

## Next tasks
- Collect + wire SUREPASS_TOKEN and META_* keys.
- Approve WhatsApp message templates matching stages (rent_due_3_days, rent_due_today, rent_overdue, rent_payment_confirmed).
