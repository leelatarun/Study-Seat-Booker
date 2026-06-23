import { Router, type IRouter } from "express";
import { eq, and, lte, gte, isNull, isNotNull, or } from "drizzle-orm";
import { db, bookingsTable, seatsTable, pricingTable } from "@workspace/db";
import {
  ListBookingsQueryParams,
  CreateBookingBody,
  GetBookingParams,
  UpdateBookingParams,
  UpdateBookingBody,
  GetBookingSummaryQueryParams,
} from "@workspace/api-zod";
import { validTokens } from "./admin";

const router: IRouter = Router();

function getSectionForSeat(seat: typeof seatsTable.$inferSelect, room2IsAc: boolean): { section: string; isAC: boolean } {
  if (seat.room === 1) return { section: "AC", isAC: true };
  if (seat.room === 2) return room2IsAc ? { section: "AC", isAC: true } : { section: "NON_AC", isAC: false };
  return { section: "NON_AC", isAC: false };
}

function dateToYYYYMM(dateStr: string): string {
  return dateStr.substring(0, 7);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function monthsBetweenYYYYMM(startMonth: string, endMonth: string): number {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm) + 1;
}

function lastDayOfMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${yyyyMm}-${String(lastDay).padStart(2, "0")}`;
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
    startDate: booking.startDate ?? null,
    endDate: booking.endDate ?? null,
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

  const monthFirstDay = `${month}-01`;
  const monthLastDay = lastDayOfMonth(month);

  const bookingsForMonth = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.status, "confirmed"),
        or(
          and(
            isNotNull(bookingsTable.startDate),
            lte(bookingsTable.startDate, monthLastDay),
            gte(bookingsTable.endDate, monthFirstDay)
          ),
          and(
            isNull(bookingsTable.startDate),
            lte(bookingsTable.month, month),
            gte(bookingsTable.endMonth, month)
          )
        )
      )
    );

  const bookedSeatIds = new Set(bookingsForMonth.map((b) => b.seatId));

  const offlineSeats = allSeats.filter((s) => {
    if (!s.isOfflineBooked) return false;
    if (!s.offlineBookingFrom || !s.offlineBookingUntil) return true;
    return s.offlineBookingFrom <= monthLastDay && s.offlineBookingUntil >= monthFirstDay;
  });

  const totalBooked = bookedSeatIds.size + offlineSeats.filter((s) => !bookedSeatIds.has(s.id)).length;

  const acSeats = allSeats.filter((s) => getSectionForSeat(s, room2IsAc).isAC);
  const nonAcSeats = allSeats.filter((s) => !getSectionForSeat(s, room2IsAc).isAC);
  const acBooked = acSeats.filter((s) => bookedSeatIds.has(s.id)).length;
  const nonAcBooked = nonAcSeats.filter((s) => bookedSeatIds.has(s.id)).length;

  const onlineRevenue = bookingsForMonth.reduce((sum, b) => {
    if (b.startDate && b.endDate) {
      const totalDays = daysBetween(b.startDate, b.endDate);
      const overlapStart = b.startDate > monthFirstDay ? b.startDate : monthFirstDay;
      const overlapEnd = b.endDate < monthLastDay ? b.endDate : monthLastDay;
      const monthDays = daysBetween(overlapStart, overlapEnd);
      return sum + (Number(b.amount) * monthDays) / totalDays;
    }
    return sum + Number(b.amount) / b.durationMonths;
  }, 0);

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
    const monthFirstDay = `${month}-01`;
    const monthLastDay = lastDayOfMonth(month);

    bookings = await db
      .select()
      .from(bookingsTable)
      .where(
        or(
          and(
            isNotNull(bookingsTable.startDate),
            lte(bookingsTable.startDate, monthLastDay),
            gte(bookingsTable.endDate, monthFirstDay)
          ),
          and(
            isNull(bookingsTable.startDate),
            lte(bookingsTable.month, month),
            gte(bookingsTable.endMonth, month)
          )
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

  const { seatId, customerName, customerPhone, customerEmail, startDate, endDate } = body.data;

  const today = new Date().toISOString().split("T")[0];
  if (startDate < today) {
    res.status(400).json({ error: "Start date cannot be in the past" });
    return;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: "End date must be on or after start date" });
    return;
  }

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, seatId)).limit(1);
  if (!seat[0]) {
    res.status(400).json({ error: "Seat not found" });
    return;
  }

  if (seat[0].isOfflineBooked) {
    res.status(400).json({ error: "This seat is currently unavailable. Please contact the admin." });
    return;
  }

  const startMonth = dateToYYYYMM(startDate);
  const endMonth = dateToYYYYMM(endDate);
  const durationMonths = monthsBetweenYYYYMM(startMonth, endMonth);
  const startDay = parseInt(startDate.split("-")[2], 10);

  const existing = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.seatId, seatId),
        eq(bookingsTable.status, "confirmed"),
        or(
          and(
            isNotNull(bookingsTable.startDate),
            lte(bookingsTable.startDate, endDate),
            gte(bookingsTable.endDate, startDate)
          ),
          and(
            isNull(bookingsTable.startDate),
            lte(bookingsTable.month, endMonth),
            gte(bookingsTable.endMonth, startMonth)
          )
        )
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
  const monthlyRate = pricing
    ? (effective.isAC ? pricing.acPrice1m : pricing.nonAcPrice1m)
    : (effective.isAC ? 2000 : 1500);

  const days = daysBetween(startDate, endDate);
  const price = Math.round((monthlyRate / 30) * days);

  const [booking] = await db
    .insert(bookingsTable)
    .values({
      seatId,
      customerName,
      customerPhone,
      customerEmail: customerEmail ?? null,
      startDate,
      endDate,
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
  const adminToken = req.headers["x-admin-token"] as string;
  if (!validTokens.has(adminToken)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

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

  const setValues: Partial<typeof bookingsTable.$inferInsert> = {
    status: body.data.status,
  };

  if (body.data.status === "confirmed") {
    setValues.paymentDate = new Date().toISOString().split("T")[0];
  }

  const [updated] = await db
    .update(bookingsTable)
    .set(setValues)
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
