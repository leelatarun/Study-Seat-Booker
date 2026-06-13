---
name: UPI payment flow + date-range booking
description: Architectural decisions from redesign — payment, booking model, admin confirm flow
---

# UPI payment + date-range booking redesign

## The rule
Razorpay is fully removed. Payment = UPI QR code (image: `attached_assets/upi_qr_code_1781343450966.jpg`, UPI ID: `9014463623@okbizaxis`). All new bookings start as `status: "pending"` until admin manually confirms via dashboard.

**Why:** Owner wanted manual verification of UPI payments before confirming seats.

**How to apply:**
- `POST /bookings` always creates with `status: "pending"`
- Admin dashboard confirm button calls `POST /api/payments/confirm` (admin-token required) with `{ bookingId }` — stamps `paymentDate` and sets `status="confirmed"`
- `POST /payments/initiate` exists as a lightweight stub (returns sessionId), called from payment page before showing UPI QR

## Admin token auth guard
The check must use OR-logic: `token === "admin123" || (!!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET)`.
Using `!== ADMIN_SECRET && !== "admin123"` silently bypasses auth when `ADMIN_SECRET` env var is undefined (both sides evaluate to false under AND).

**Why:** Discovered in testing — no-token PATCH returned 200 instead of 401.

## Booking model change
BookingInput now uses `startDate` and `endDate` (YYYY-MM-DD strings) instead of `month`/`durationMonths`/`startDay`.
- `month`/`endMonth`/`durationMonths`/`startDay` are always derived server-side from the dates (kept for backward compat)
- Pricing: `Math.round((monthlyRate / 30) * days)`
- Conflict check: date-overlap for new bookings, month-overlap for legacy (null startDate)
