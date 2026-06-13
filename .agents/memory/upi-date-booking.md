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
- Admin dashboard has a "✓ Confirm" button on pending bookings tab calling `PATCH /bookings/:id` with `{ status: "confirmed" }` — this stamps `paymentDate`
- `POST /payments/initiate` still exists as a stub (returns sessionId) but does nothing real
- `POST /payments/confirm` is gone — do NOT re-add it

## Booking model change
BookingInput now uses `startDate` and `endDate` (YYYY-MM-DD strings) instead of `month`/`durationMonths`/`startDay`.
- `month`/`endMonth`/`durationMonths`/`startDay` are always derived server-side from the dates (kept for backward compat with seat availability queries)
- Pricing: `Math.round((monthlyRate / 30) * days)`
- Conflict check: date-overlap for new bookings (`startDate`/`endDate`), month-overlap for legacy

**Why:** Customers wanted flexible date ranges, not whole-month-only bookings.

## DB schema
- `startDate` TEXT nullable, `endDate` TEXT nullable added to bookings table — push was run 2026-06-13
- After any OpenAPI spec change: `pnpm --filter @workspace/api-spec run codegen`
