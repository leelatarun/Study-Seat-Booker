import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bookingsTable, seatsTable, pricingTable } from "@workspace/db";
import {
  ListBookingsQueryParams,
  CreateBookingBody,
  GetBookingParams,
  UpdateBookingParams,
  UpdateBookingBody,
  GetBookingSummaryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatBooking(booking: typeof bookingsTable.$inferSelect, seat?: typeof seatsTable.$inferSelect) {
  return {
    id: booking.id,
    seatId: booking.seatId,
    seatNumber: seat?.seatNumber ?? booking.seatId,
    section: seat?.section ?? "UNKNOWN",
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    customerEmail: booking.customerEmail ?? null,
    month: booking.month,
    amount: Number(booking.amount),
    status: booking.status,
    paymentSessionId: booking.paymentSessionId ?? null,
    createdAt: booking.createdAt.toISOString(),
  };
}

router.get("/bookings/summary", async (req, res): Promise<void> => {
  const query = GetBookingSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { month } = query.data;
  const allSeats = await db.select().from(seatsTable);
  const bookingsForMonth = await db
    .select()
    .from(bookingsTable)
    .where(and(eq(bookingsTable.month, month), eq(bookingsTable.status, "confirmed")));

  const pricing = await db.select().from(pricingTable).limit(1);
  const acPrice = pricing[0] ? Number(pricing[0].acPrice) : 2000;
  const nonAcPrice = pricing[0] ? Number(pricing[0].nonAcPrice) : 1500;

  const bookedSeatIds = new Set(bookingsForMonth.map((b) => b.seatId));
  const acSeats = allSeats.filter((s) => s.isAC);
  const nonAcSeats = allSeats.filter((s) => !s.isAC);
  const acBooked = acSeats.filter((s) => bookedSeatIds.has(s.id)).length;
  const nonAcBooked = nonAcSeats.filter((s) => bookedSeatIds.has(s.id)).length;
  const revenue = acBooked * acPrice + nonAcBooked * nonAcPrice;

  res.json({
    month,
    totalSeats: allSeats.length,
    bookedSeats: bookingsForMonth.length,
    availableSeats: allSeats.length - bookingsForMonth.length,
    acBooked,
    nonAcBooked,
    revenue,
  });
});

router.get("/bookings", async (req, res): Promise<void> => {
  const query = ListBookingsQueryParams.safeParse(req.query);
  const month = query.success ? query.data.month : undefined;

  const allSeats = await db.select().from(seatsTable);
  const seatMap = new Map(allSeats.map((s) => [s.id, s]));

  let bookings;
  if (month) {
    bookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.month, month))
      .orderBy(bookingsTable.createdAt);
  } else {
    bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.createdAt);
  }

  res.json(bookings.map((b) => formatBooking(b, seatMap.get(b.seatId))));
});

router.post("/bookings", async (req, res): Promise<void> => {
  const body = CreateBookingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, body.data.seatId)).limit(1);
  if (!seat[0]) {
    res.status(400).json({ error: "Seat not found" });
    return;
  }

  if (seat[0].isUnderMaintenance) {
    res.status(400).json({ error: "Seat is under maintenance" });
    return;
  }

  const existing = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.seatId, body.data.seatId),
        eq(bookingsTable.month, body.data.month),
        eq(bookingsTable.status, "confirmed")
      )
    )
    .limit(1);

  if (existing[0]) {
    res.status(409).json({ error: "Seat already booked for this month" });
    return;
  }

  const pricing = await db.select().from(pricingTable).limit(1);
  const price = seat[0].isAC
    ? (pricing[0] ? Number(pricing[0].acPrice) : 2000)
    : (pricing[0] ? Number(pricing[0].nonAcPrice) : 1500);

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      seatId: body.data.seatId,
      customerName: body.data.customerName,
      customerPhone: body.data.customerPhone,
      customerEmail: body.data.customerEmail ?? null,
      month: body.data.month,
      amount: String(price),
      status: "pending",
    })
    .returning();

  res.status(201).json(formatBooking(booking, seat[0]));
});

router.get("/bookings/:id", async (req, res): Promise<void> => {
  const params = GetBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const booking = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, params.data.id))
    .limit(1);

  if (!booking[0]) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, booking[0].seatId)).limit(1);
  res.json(formatBooking(booking[0], seat[0]));
});

router.patch("/bookings/:id", async (req, res): Promise<void> => {
  const params = UpdateBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateBookingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: body.data.status })
    .where(eq(bookingsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, updated.seatId)).limit(1);
  res.json(formatBooking(updated, seat[0]));
});

export default router;
