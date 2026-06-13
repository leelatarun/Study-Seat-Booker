import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bookingsTable, seatsTable, pricingTable } from "@workspace/db";
import { InitiatePaymentBody, ConfirmPaymentBody } from "@workspace/api-zod";
import crypto from "crypto";
import Razorpay from "razorpay";
import { sendBookingConfirmations } from "../lib/notifications.js";

const router: IRouter = Router();

// Lazy-initialised so the module loads even if env vars haven't propagated yet
let _razorpay: Razorpay | null = null;
function getRazorpay(): Razorpay {
  if (!_razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Error("Razorpay credentials not configured");
    _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return _razorpay;
}

const paymentSessions = new Map<string, { bookingId: number; amount: number; expiresAt: Date }>();

function getSectionForSeat(seat: typeof seatsTable.$inferSelect, room2IsAc: boolean): string {
  if (seat.room === 1) return "AC";
  if (seat.room === 2) return room2IsAc ? "AC" : "NON_AC";
  return "NON_AC";
}

function formatBooking(
  booking: typeof bookingsTable.$inferSelect,
  seat?: typeof seatsTable.$inferSelect,
  room2IsAc = false
) {
  const section = seat ? getSectionForSeat(seat, room2IsAc) : "UNKNOWN";
  return {
    id: booking.id,
    seatId: booking.seatId,
    seatNumber: seat?.seatNumber ?? booking.seatId,
    section,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail ?? null,
    month: booking.month,
    endMonth: booking.endMonth,
    durationMonths: booking.durationMonths,
    startDay: booking.startDay ?? null,
    amount: Number(booking.amount),
    status: booking.status,
    paymentDate: booking.paymentDate ?? null,
    paymentSessionId: booking.paymentSessionId ?? null,
    createdAt: booking.createdAt.toISOString(),
  };
}

async function getBookingWithContext(bookingId: number) {
  const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
  if (!booking) return null;
  const [seat] = await db.select().from(seatsTable).where(eq(seatsTable.id, booking.seatId)).limit(1);
  const [pricingRow] = await db.select().from(pricingTable).limit(1);
  const room2IsAc = pricingRow?.room2IsAc ?? false;
  return { booking, seat, room2IsAc };
}

// ── Legacy demo payment (kept for backwards compat) ───────────────────────────
router.post("/payments/initiate", async (req, res): Promise<void> => {
  const body = InitiatePaymentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const ctx = await getBookingWithContext(body.data.bookingId);
  if (!ctx) { res.status(404).json({ error: "Booking not found" }); return; }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  paymentSessions.set(sessionId, { bookingId: ctx.booking.id, amount: Number(ctx.booking.amount), expiresAt });
  await db.update(bookingsTable).set({ paymentSessionId: sessionId }).where(eq(bookingsTable.id, ctx.booking.id));

  res.json({ sessionId, bookingId: ctx.booking.id, amount: Number(ctx.booking.amount), expiresAt: expiresAt.toISOString() });
});

router.post("/payments/confirm", async (req, res): Promise<void> => {
  const body = ConfirmPaymentBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const session = paymentSessions.get(body.data.sessionId);
  if (!session || session.bookingId !== body.data.bookingId) {
    res.status(400).json({ error: "Invalid or expired payment session" }); return;
  }
  if (new Date() > session.expiresAt) {
    paymentSessions.delete(body.data.sessionId);
    res.status(400).json({ error: "Payment session expired" }); return;
  }

  paymentSessions.delete(body.data.sessionId);
  const today = new Date().toISOString().split("T")[0];

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "confirmed", paymentDate: today })
    .where(eq(bookingsTable.id, body.data.bookingId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Booking not found" }); return; }

  const ctx = await getBookingWithContext(updated.id);
  const formatted = formatBooking(updated, ctx?.seat, ctx?.room2IsAc);
  res.json(formatted);

  sendBookingConfirmations({
    bookingId: formatted.id,
    customerName: formatted.customerName,
    customerPhone: formatted.customerPhone,
    customerEmail: formatted.customerEmail,
    seatNumber: formatted.seatNumber,
    section: formatted.section,
    month: formatted.month,
    endMonth: formatted.endMonth,
    durationMonths: formatted.durationMonths,
    amount: formatted.amount,
  }, req.log).catch(() => undefined);
});

// ── Razorpay: create order ────────────────────────────────────────────────────
router.post("/payments/create-order", async (req, res): Promise<void> => {
  const { bookingId } = req.body as { bookingId?: number };
  if (!bookingId) { res.status(400).json({ error: "bookingId is required" }); return; }

  const ctx = await getBookingWithContext(bookingId);
  if (!ctx) { res.status(404).json({ error: "Booking not found" }); return; }

  // Only pending bookings should be going through checkout
  if (ctx.booking.status !== "pending") {
    res.status(400).json({ error: "Booking is not in pending state" }); return;
  }

  const amountPaise = Math.round(Number(ctx.booking.amount) * 100);
  if (amountPaise < 100) { res.status(400).json({ error: "Amount too small" }); return; }

  // Reuse an existing unfulfilled Razorpay order to avoid duplicate orders on retry
  if (ctx.booking.razorpayOrderId) {
    try {
      const existing = await getRazorpay().orders.fetch(ctx.booking.razorpayOrderId);
      if (existing && (existing.status === "created" || existing.status === "attempted")) {
        res.json({
          orderId: existing.id,
          amount: amountPaise,
          currency: "INR",
          keyId: process.env.RAZORPAY_KEY_ID ?? "",
        });
        return;
      }
    } catch {
      // Existing order fetch failed — fall through to create a new one
    }
  }

  try {
    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `booking_${bookingId}`,
    });

    // Persist the order ID so retries can reuse it
    await db.update(bookingsTable).set({ razorpayOrderId: order.id }).where(eq(bookingsTable.id, bookingId));

    res.json({
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
    });
  } catch (err: any) {
    req.log?.error({ err }, "Razorpay create order failed");
    res.status(500).json({ error: "Failed to create Razorpay order" });
  }
});

// ── Razorpay: verify signature + confirm booking ──────────────────────────────
router.post("/payments/verify", async (req, res): Promise<void> => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body as {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    bookingId?: number;
  };

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !bookingId) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "")
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    res.status(400).json({ error: "Payment signature verification failed" }); return;
  }

  const today = new Date().toISOString().split("T")[0];

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "confirmed", paymentDate: today, paymentSessionId: razorpayPaymentId })
    .where(eq(bookingsTable.id, bookingId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Booking not found" }); return; }

  const ctx = await getBookingWithContext(updated.id);
  const formatted = formatBooking(updated, ctx?.seat, ctx?.room2IsAc);
  res.json(formatted);

  sendBookingConfirmations({
    bookingId: formatted.id,
    customerName: formatted.customerName,
    customerPhone: formatted.customerPhone,
    customerEmail: formatted.customerEmail,
    seatNumber: formatted.seatNumber,
    section: formatted.section,
    month: formatted.month,
    endMonth: formatted.endMonth,
    durationMonths: formatted.durationMonths,
    amount: formatted.amount,
  }, req.log).catch(() => undefined);
});

export default router;
