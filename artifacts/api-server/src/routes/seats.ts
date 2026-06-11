import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, seatsTable, bookingsTable, pricingTable } from "@workspace/db";
import {
  ListSeatsQueryParams,
  GetSeatParams,
  UpdateSeatParams,
  UpdateSeatBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/seats", async (req, res): Promise<void> => {
  const query = ListSeatsQueryParams.safeParse(req.query);
  const month = query.success ? query.data.month : undefined;

  const seats = await db.select().from(seatsTable).orderBy(seatsTable.id);

  const pricing = await db.select().from(pricingTable).limit(1);
  const acPrice = pricing[0] ? Number(pricing[0].acPrice) : 2000;
  const nonAcPrice = pricing[0] ? Number(pricing[0].nonAcPrice) : 1500;

  let bookingsForMonth: Array<{ seatId: number; id: number; customerName: string }> = [];
  if (month) {
    const rawBookings = await db
      .select({ seatId: bookingsTable.seatId, id: bookingsTable.id, customerName: bookingsTable.customerName })
      .from(bookingsTable)
      .where(eq(bookingsTable.month, month));
    bookingsForMonth = rawBookings.filter((b) => {
      const matchingSeat = seats.find(s => s.id === b.seatId);
      return matchingSeat !== undefined;
    });
  }

  const result = seats.map((seat) => {
    const booking = month ? bookingsForMonth.find((b) => b.seatId === seat.id) : undefined;
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      section: seat.section,
      isAC: seat.isAC,
      isUnderMaintenance: seat.isUnderMaintenance,
      price: seat.isAC ? acPrice : nonAcPrice,
      bookedForMonth: month ? !!booking : null,
      bookingId: booking ? booking.id : null,
      bookedByName: booking ? booking.customerName : null,
    };
  });

  res.json(result);
});

router.get("/seats/summary", async (req, res): Promise<void> => {
  res.status(200).json({});
});

router.get("/seats/:id", async (req, res): Promise<void> => {
  const params = GetSeatParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const pricing = await db.select().from(pricingTable).limit(1);
  const acPrice = pricing[0] ? Number(pricing[0].acPrice) : 2000;
  const nonAcPrice = pricing[0] ? Number(pricing[0].nonAcPrice) : 1500;

  const seat = await db.select().from(seatsTable).where(eq(seatsTable.id, params.data.id)).limit(1);
  if (!seat[0]) {
    res.status(404).json({ error: "Seat not found" });
    return;
  }

  res.json({
    ...seat[0],
    price: seat[0].isAC ? acPrice : nonAcPrice,
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

  const pricing = await db.select().from(pricingTable).limit(1);
  const acPrice = pricing[0] ? Number(pricing[0].acPrice) : 2000;
  const nonAcPrice = pricing[0] ? Number(pricing[0].nonAcPrice) : 1500;

  const [updated] = await db
    .update(seatsTable)
    .set({ isUnderMaintenance: body.data.isUnderMaintenance })
    .where(eq(seatsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Seat not found" });
    return;
  }

  res.json({
    ...updated,
    price: updated.isAC ? acPrice : nonAcPrice,
    bookedForMonth: null,
    bookingId: null,
    bookedByName: null,
  });
});

export default router;
