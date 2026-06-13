import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bookingsTable, seatsTable, pricingTable } from "@workspace/db";
import { InitiatePaymentBody, ConfirmPaymentBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function getSectionForSeat(seat: typeof seatsTable.$inferSelect, room2IsAc: boolean): string {
  if (seat.room === 1) return "AC";
  if (seat.room === 2) return room2IsAc ? "AC" : "NON_AC";
  return "NON_AC";
}

function isValidAdmin(token: string | string[] | undefined): boolean {
  return (
    token === "admin123" ||
    (!!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET)
  );
}

// UPI QR payment flow — booking stays "pending" until admin manually confirms
// This endpoint records intent; no charge is processed here
router.post("/payments/initiate", async (req, res): Promise<void> => {
  const body = InitiatePaymentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, body.data.bookingId))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  res.json({
    sessionId,
    bookingId: booking.id,
    amount: Number(booking.amount),
    expiresAt: expiresAt.toISOString(),
  });
});

// Admin-only: confirm UPI payment after manual verification
router.post("/payments/confirm", async (req, res): Promise<void> => {
  if (!isValidAdmin(req.headers["x-admin-token"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = ConfirmPaymentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, body.data.bookingId))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "confirmed", paymentDate: today })
    .where(eq(bookingsTable.id, booking.id))
    .returning();

  // Look up seat and pricing for full Booking response shape
  const [seat] = await db
    .select()
    .from(seatsTable)
    .where(eq(seatsTable.id, updated.seatId))
    .limit(1);
  const [pricingRow] = await db.select().from(pricingTable).limit(1);
  const room2IsAc = pricingRow?.room2IsAc ?? false;

  const section = seat ? getSectionForSeat(seat, room2IsAc) : "AC";
  const startMonth = updated.startDate
    ? updated.startDate.substring(0, 7)
    : (updated.month ?? "");
  const endMonth = updated.endDate
    ? updated.endDate.substring(0, 7)
    : (updated.endMonth ?? startMonth);

  res.json({
    id: updated.id,
    seatId: updated.seatId,
    seatNumber: seat?.seatNumber ?? 0,
    section,
    customerName: updated.customerName,
    customerPhone: updated.customerPhone,
    customerEmail: updated.customerEmail ?? null,
    startDate: updated.startDate ?? null,
    endDate: updated.endDate ?? null,
    month: startMonth,
    endMonth,
    durationMonths: updated.durationMonths ?? 1,
    startDay: updated.startDay ?? null,
    amount: Number(updated.amount),
    status: updated.status,
    paymentDate: updated.paymentDate ?? null,
    paymentSessionId: updated.paymentSessionId ?? null,
    createdAt: updated.createdAt,
  });
});

export default router;
