import { Router, type IRouter } from "express";
import { eq, and, lte, gte } from "drizzle-orm";
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

function calcEndMonth(startMonth: string, durationMonths: number): string {
  const [year, m] = startMonth.split("-").map(Number);
  const totalMonths = year * 12 + m - 1 + (durationMonths - 1);
  const endYear = Math.floor(totalMonths / 12);
  const endMon = (totalMonths % 12) + 1;
  return `${endYear}-${String(endMon).padStart(2, "0")}`;
}

function getPriceForDuration(
  pricing: typeof pricingTable.$inferSelect,
  isAc: boolean,
  duration: number
): number {
  if (isAc) {
    if (duration === 2) return pricing.acPrice2m;
    if (duration === 3) return pricing.acPrice3m;
    if (duration === 6) return pricing.acPrice6m;
    return pricing.acPrice1m;
  } else {
    if (duration === 2) return pricing.nonAcPrice2m;
    if (duration === 3) return pricing.nonAcPrice3m;
    if (duration === 6) return pricing.nonAcPrice6m;
    return pricing.nonAcPrice1m;
  }
}

function getSectionForSeat(seat: typeof seatsTable.$inferSelect, room2IsAc: boolean): { section: string; isAC: boolean } {
  if (seat.room === 1) return { section: "AC", isAC: true };
  if (seat.room === 2) return room2IsAc ? { section: "AC", isAC: true } : { section: "NON_AC", isAC: false };
  return { section: "NON_AC", isAC: false };
}

function formatBooking(
  booking: typeof bookingsTable.$inferSelect,
  seat?: typeof seatsTable.$inferSelect,
  room2IsAc = false
) {
  const section = seat ? getSectionForSeat(seat, room2IsAc).section : "UNKNOWN";
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

router.get("/bookings/summary", async (req, res): Promise<void> => {
  const query = GetBookingSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { month } = query.data;
  const allSeats = await db.select().from(seatsTable);
  const pricingRow = await db.select().from(pricingTable).limit(1);
  const pricing = pricingRow[0];
  const room2IsAc = pricing?.room2IsAc ?? false;

  // Online confirmed bookings for this month
  const bookingsForMonth = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        lte(bookingsTable.month, month),
        gte(bookingsTable.endMonth, month),
        eq(bookingsTable.status, "confirmed")
      )
    );

  const bookedSeatIds = new Set(bookingsForMonth.map((b) => b.seatId));

  // Offline-booked seats active for this month
  const offlineSeats = allSeats.filter((s) => {
    if (!s.isOfflineBooked) return false;
    // If no dates set, count it as active
    if (!s.offlineBookingFrom || !s.offlineBookingUntil) return true;
    return s.offlineBookingFrom <= month && s.offlineBookingUntil >= month;
  });

  const totalBooked = bookedSeatIds.size + offlineSeats.filter((s) => !bookedSeatIds.has(s.id)).length;

  const acSeats = allSeats.filter((s) => getSectionForSeat(s, room2IsAc).isAC);
  const nonAcSeats = allSeats.filter((s) => !getSectionForSeat(s, room2IsAc).isAC);
  const acBooked = acSeats.filter((s) => bookedSeatIds.has(s.id)).length;
  const nonAcBooked = nonAcSeats.filter((s) => bookedSeatIds.has(s.id)).length;

  // Online revenue (per-month share of multi-month bookings)
  const onlineRevenue = bookingsForMonth.reduce((sum, b) => sum + Number(b.amount) / b.durationMonths, 0);

  // Offline revenue (1 month of each offline seat's price)
  const offlineRevenue = offlineSeats
    .filter((s) => !bookedSeatIds.has(s.id))
    .reduce((sum, s) => {
      const isAC = getSectionForSeat(s, room2IsAc).isAC;
      const price = pricing ? (isAC ? pricing.acPrice1m : pricing.nonAcPrice1m) : (isAC ? 2000 : 1500);
      return sum + price;
    }, 0);

  res.json({
    month,
    totalSeats: allSeats.length,
    bookedSeats: totalBooked,
    availableSeats: allSeats.length - totalBooked,
    acBooked,
    nonAcBooked,
    revenue: Math.round(onlineRevenue + offlineRevenue),
  });
});

router.get("/bookings", async (req, res): Promise<void> => {
  const query = ListBookingsQueryParams.safeParse(req.query);
  const month = query.success ? query.data.month : undefined;
  const allSeats = await db.select().from(seatsTable);
  const seatMap = new Map(allSeats.map((s) => [s.id, s]));
  const pricingRow = await db.select().from(pricingTable).limit(1);
  const room2IsAc = pricingRow[0]?.room2IsAc ?? false;

  let bookings;
  if (month) {
    bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          lte(bookingsTable.month, month),
          gte(bookingsTable.endMonth, month)
        )
      )
      .orderBy(bookingsTable.createdAt);
  } else {
    bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.createdAt);
  }

  res.json(bookings.map((b) => formatBooking(b, seatMap.get(b.seatId), room2IsAc)));
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

  if (seat[0].isOfflineBooked) {
    res.status(400).json({ error: "This seat has been booked offline. Please contact the admin." });
    return;
  }

  const durationMonths = body.data.durationMonths ?? 1;
  const startMonth = body.data.month;
  const endMonth = calcEndMonth(startMonth, durationMonths);
  const startDay = body.data.startDay ?? 1;

  // Check for any overlapping confirmed booking
  const existing = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.seatId, body.data.seatId),
        eq(bookingsTable.status, "confirmed"),
        lte(bookingsTable.month, endMonth),
        gte(bookingsTable.endMonth, startMonth)
      )
    )
    .limit(1);

  if (existing[0]) {
    res.status(409).json({ error: "Seat already booked for this period" });
    return;
  }

  const pricingRow = await db.select().from(pricingTable).limit(1);
  const pricing = pricingRow[0];
  const room2IsAc = pricing?.room2IsAc ?? false;
  const effective = getSectionForSeat(seat[0], room2IsAc);

  const price = pricing
    ? getPriceForDuration(pricing, effective.isAC, durationMonths)
    : (effective.isAC ? 2000 : 1500);

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      seatId: body.data.seatId,
      customerName: body.data.customerName,
      customerPhone: body.data.customerPhone,
      customerEmail: body.data.customerEmail ?? null,
      month: startMonth,
      endMonth,
      durationMonths,
      startDay,
      amount: String(price),
      status: "pending",
    })
    .returning();

  res.status(201).json(formatBooking(booking, seat[0], room2IsAc));
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
  const pricingRow = await db.select().from(pricingTable).limit(1);
  const room2IsAc = pricingRow[0]?.room2IsAc ?? false;
  res.json(formatBooking(booking[0], seat[0], room2IsAc));
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
  const pricingRow = await db.select().from(pricingTable).limit(1);
  const room2IsAc = pricingRow[0]?.room2IsAc ?? false;
  res.json(formatBooking(updated, seat[0], room2IsAc));
});

export default router;
