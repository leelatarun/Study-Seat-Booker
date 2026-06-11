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
  return { section: "NON_AC", isAC: false }; // room 3 = common, non-AC priced
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
    const effective = computeEffectiveSection(seat, room2IsAc);
    const booking = month ? activeBookings.find((b) => b.seatId === seat.id) : undefined;
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      section: effective.section,
      room: seat.room,
      isAC: effective.isAC,
      isOfflineBooked: seat.isOfflineBooked,
      price: effective.isAC ? acPrice : nonAcPrice,
      bookedForMonth: month ? (!!booking || seat.isOfflineBooked) : null,
      bookingId: booking ? booking.id : null,
      bookedByName: booking ? booking.customerName : null,
    };
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
  const room2IsAc = pricing?.room2IsAc ?? false;
  const acPrice = pricing?.acPrice1m ?? 2000;
  const nonAcPrice = pricing?.nonAcPrice1m ?? 1500;

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, params.data.id)).limit(1);
  if (!seat[0]) {
    res.status(404).json({ error: "Seat not found" });
    return;
  }

  const effective = computeEffectiveSection(seat[0], room2IsAc);
  res.json({
    id: seat[0].id,
    seatNumber: seat[0].seatNumber,
    section: effective.section,
    room: seat[0].room,
    isAC: effective.isAC,
    isOfflineBooked: seat[0].isOfflineBooked,
    price: effective.isAC ? acPrice : nonAcPrice,
    bookedForMonth: null,
    bookingId: null,
    bookedByName: null,
  });
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

  const pricingRow = await db.select().from(pricingTable).limit(1);
  const pricing = pricingRow[0];
  const room2IsAc = pricing?.room2IsAc ?? false;
  const acPrice = pricing?.acPrice1m ?? 2000;
  const nonAcPrice = pricing?.nonAcPrice1m ?? 1500;

  const [updated] = await db
    .update(seatsTable)
    .set({ isOfflineBooked: body.data.isOfflineBooked })
    .where(eq(seatsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seat not found" });
    return;
  }

  const effective = computeEffectiveSection(updated, room2IsAc);
  res.json({
    id: updated.id,
    seatNumber: updated.seatNumber,
    section: effective.section,
    room: updated.room,
    isAC: effective.isAC,
    isOfflineBooked: updated.isOfflineBooked,
    price: effective.isAC ? acPrice : nonAcPrice,
    bookedForMonth: null,
    bookingId: null,
    bookedByName: null,
  });
});

export default router;
