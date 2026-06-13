import { Router, type IRouter } from "express";
import { eq, lte, gte, and } from "drizzle-orm";
import { db, seatsTable, bookingsTable, pricingTable } from "@workspace/db";
import {
  ListSeatsQueryParams,
  GetSeatParams,
  UpdateSeatParams,
  UpdateSeatBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function computeEffectiveSection(seat: typeof seatsTable.$inferSelect, room2IsAc: boolean) {
  if (seat.room === 1) return { section: "AC", isAC: true };
  if (seat.room === 2) return room2IsAc ? { section: "AC", isAC: true } : { section: "NON_AC", isAC: false };
  return { section: "NON_AC", isAC: false };
}

function formatSeat(
  seat: typeof seatsTable.$inferSelect,
  room2IsAc: boolean,
  acPrice: number,
  nonAcPrice: number,
  extra?: { bookedForMonth?: boolean | null; bookingId?: number | null; bookedByName?: string | null }
) {
  const effective = computeEffectiveSection(seat, room2IsAc);
  // Auto-expire offline bookings: once today passes offlineBookingUntil, treat seat as available
  const today = new Date().toISOString().split("T")[0];
  const effectiveOfflineBooked =
    seat.isOfflineBooked &&
    (!seat.offlineBookingUntil || seat.offlineBookingUntil >= today);
  return {
    id: seat.id,
    seatNumber: seat.seatNumber,
    section: effective.section,
    room: seat.room,
    isAC: effective.isAC,
    isOfflineBooked: effectiveOfflineBooked,
    offlineBookingName: seat.offlineBookingName ?? null,
    offlineBookingPhone: seat.offlineBookingPhone ?? null,
    offlineBookingFrom: seat.offlineBookingFrom ?? null,
    offlineBookingUntil: seat.offlineBookingUntil ?? null,
    price: effective.isAC ? acPrice : nonAcPrice,
    bookedForMonth: extra?.bookedForMonth ?? null,
    bookingId: extra?.bookingId ?? null,
    bookedByName: extra?.bookedByName ?? null,
  };
}

router.get("/seats", async (req, res): Promise<void> => {
  const query = ListSeatsQueryParams.safeParse(req.query);
  const month = query.success ? query.data.month : undefined;

  const seats = await db.select().from(seatsTable).orderBy(seatsTable.id);
  const pricingRow = await db.select().from(pricingTable).limit(1);
  const pricing = pricingRow[0];
  const room2IsAc = pricing?.room2IsAc ?? false;
  const acPrice = pricing?.acPrice1m ?? 2000;
  const nonAcPrice = pricing?.nonAcPrice1m ?? 1500;

  let activeBookings: Array<{ seatId: number; id: number; customerName: string }> = [];
  if (month) {
    activeBookings = await db
      .select({ seatId: bookingsTable.seatId, id: bookingsTable.id, customerName: bookingsTable.customerName })
      .from(bookingsTable)
      .where(
        and(
          lte(bookingsTable.month, month),
          gte(bookingsTable.endMonth, month),
          eq(bookingsTable.status, "confirmed")
        )
      );
  }

  const result = seats.map((seat) => {
    const booking = month ? activeBookings.find((b) => b.seatId === seat.id) : undefined;
    return formatSeat(seat, room2IsAc, acPrice, nonAcPrice, {
      bookedForMonth: month ? (!!booking || seat.isOfflineBooked) : null,
      bookingId: booking ? booking.id : null,
      bookedByName: booking ? booking.customerName : null,
    });
  });

  res.json(result);
});

router.get("/seats/summary", async (_req, res): Promise<void> => {
  res.status(200).json({});
});

router.get("/seats/:id", async (req, res): Promise<void> => {
  const params = GetSeatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const pricingRow = await db.select().from(pricingTable).limit(1);
  const pricing = pricingRow[0];

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, params.data.id)).limit(1);
  if (!seat[0]) {
    res.status(404).json({ error: "Seat not found" });
    return;
  }

  res.json(formatSeat(seat[0], pricing?.room2IsAc ?? false, pricing?.acPrice1m ?? 2000, pricing?.nonAcPrice1m ?? 1500));
});

router.patch("/seats/:id", async (req, res): Promise<void> => {
  const adminToken = req.headers["x-admin-token"];
  if (adminToken !== process.env.ADMIN_SECRET && adminToken !== "admin123") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = UpdateSeatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateSeatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const setValues: Partial<typeof seatsTable.$inferInsert> = {};

  if (body.data.isOfflineBooked !== undefined) {
    setValues.isOfflineBooked = body.data.isOfflineBooked;
    // When turning off, clear the offline booking info
    if (!body.data.isOfflineBooked) {
      setValues.offlineBookingName = null;
      setValues.offlineBookingPhone = null;
      setValues.offlineBookingFrom = null;
      setValues.offlineBookingUntil = null;
    }
  }
  if (body.data.offlineBookingName !== undefined) setValues.offlineBookingName = body.data.offlineBookingName ?? null;
  if (body.data.offlineBookingPhone !== undefined) setValues.offlineBookingPhone = body.data.offlineBookingPhone ?? null;
  if (body.data.offlineBookingFrom !== undefined) setValues.offlineBookingFrom = body.data.offlineBookingFrom ?? null;
  if (body.data.offlineBookingUntil !== undefined) setValues.offlineBookingUntil = body.data.offlineBookingUntil ?? null;

  const pricingRow = await db.select().from(pricingTable).limit(1);
  const pricing = pricingRow[0];

  const [updated] = await db
    .update(seatsTable)
    .set(setValues)
    .where(eq(seatsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seat not found" });
    return;
  }

  res.json(formatSeat(updated, pricing?.room2IsAc ?? false, pricing?.acPrice1m ?? 2000, pricing?.nonAcPrice1m ?? 1500));
});

export default router;
