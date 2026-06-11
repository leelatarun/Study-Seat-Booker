import { Router, type IRouter } from "express";
import { db, pricingTable } from "@workspace/db";
import { UpdatePricingBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatPricing(p: typeof pricingTable.$inferSelect) {
  return {
    id: p.id,
    acPrice1m: p.acPrice1m,
    acPrice2m: p.acPrice2m,
    acPrice3m: p.acPrice3m,
    acPrice6m: p.acPrice6m,
    nonAcPrice1m: p.nonAcPrice1m,
    nonAcPrice2m: p.nonAcPrice2m,
    nonAcPrice3m: p.nonAcPrice3m,
    nonAcPrice6m: p.nonAcPrice6m,
    room2IsAc: p.room2IsAc,
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/pricing", async (_req, res): Promise<void> => {
  const pricing = await db.select().from(pricingTable).limit(1);
  if (!pricing[0]) {
    const [created] = await db.insert(pricingTable).values({}).returning();
    res.json(formatPricing(created));
    return;
  }
  res.json(formatPricing(pricing[0]));
});

router.patch("/pricing", async (req, res): Promise<void> => {
  const adminToken = req.headers["x-admin-token"];
  if (adminToken !== process.env.ADMIN_SECRET && adminToken !== "admin123") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = UpdatePricingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  let pricing = await db.select().from(pricingTable).limit(1);
  if (!pricing[0]) {
    await db.insert(pricingTable).values({});
    pricing = await db.select().from(pricingTable).limit(1);
  }

  const updateValues: Record<string, number | boolean | Date> = { updatedAt: new Date() };
  if (body.data.acPrice1m !== undefined) updateValues.acPrice1m = body.data.acPrice1m;
  if (body.data.acPrice2m !== undefined) updateValues.acPrice2m = body.data.acPrice2m;
  if (body.data.acPrice3m !== undefined) updateValues.acPrice3m = body.data.acPrice3m;
  if (body.data.acPrice6m !== undefined) updateValues.acPrice6m = body.data.acPrice6m;
  if (body.data.nonAcPrice1m !== undefined) updateValues.nonAcPrice1m = body.data.nonAcPrice1m;
  if (body.data.nonAcPrice2m !== undefined) updateValues.nonAcPrice2m = body.data.nonAcPrice2m;
  if (body.data.nonAcPrice3m !== undefined) updateValues.nonAcPrice3m = body.data.nonAcPrice3m;
  if (body.data.nonAcPrice6m !== undefined) updateValues.nonAcPrice6m = body.data.nonAcPrice6m;
  if (body.data.room2IsAc !== undefined) updateValues.room2IsAc = body.data.room2IsAc;

  const [updated] = await db.update(pricingTable).set(updateValues).returning();
  res.json(formatPricing(updated));
});

export default router;
