import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, bookingsTable, seatsTable, pricingTable } from "@workspace/db";
import { InitiatePaymentBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function getSectionForSeat(seat: typeof seatsTable.$inferSelect, room2IsAc: boolean): string {
  if (seat.room === 1) return "AC";
  if (seat.room === 2) return room2IsAc ? "AC" : "NON_AC";
  return "NON_AC";
}

// UPI QR payment flow — booking stays "pending" until admin manually confirms
// This endpoint exists so the frontend hook doesn't 404; it's a lightweight acknowledgement
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

export default router;
