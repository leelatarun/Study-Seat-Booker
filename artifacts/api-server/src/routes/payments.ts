import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bookingsTable, seatsTable, pricingTable } from "@workspace/db";
import { InitiatePaymentBody, ConfirmPaymentBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

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

router.post("/payments/initiate", async (req, res): Promise<void> => {
  const body = InitiatePaymentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const booking = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, body.data.bookingId))
    .limit(1);

  if (!booking[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  paymentSessions.set(sessionId, {
    bookingId: booking[0].id,
    amount: Number(booking[0].amount),
    expiresAt,
  });

  await db
    .update(bookingsTable)
    .set({ paymentSessionId: sessionId })
    .where(eq(bookingsTable.id, booking[0].id));

  res.json({
    sessionId,
    bookingId: booking[0].id,
    amount: Number(booking[0].amount),
    expiresAt: expiresAt.toISOString(),
  });
});

router.post("/payments/confirm", async (req, res): Promise<void> => {
  const body = ConfirmPaymentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const session = paymentSessions.get(body.data.sessionId);
  if (!session || session.bookingId !== body.data.bookingId) {
    res.status(400).json({ error: "Invalid or expired payment session" });
    return;
  }

  if (new Date() > session.expiresAt) {
    paymentSessions.delete(body.data.sessionId);
    res.status(400).json({ error: "Payment session expired" });
    return;
  }

  paymentSessions.delete(body.data.sessionId);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "confirmed", paymentDate: today })
    .where(eq(bookingsTable.id, body.data.bookingId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, updated.seatId)).limit(1);
  const pricingRow = await db.select().from(pricingTable).limit(1);
  const room2IsAc = pricingRow[0]?.room2IsAc ?? false;
  res.json(formatBooking(updated, seat[0], room2IsAc));
});

export default router;
