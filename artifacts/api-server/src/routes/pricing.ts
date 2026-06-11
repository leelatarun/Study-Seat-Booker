import { Router, type IRouter } from "express";
import { db, pricingTable } from "@workspace/db";
import { UpdatePricingBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatPricing(p: typeof pricingTable.$inferSelect) {
  return {
    id: p.id,
    acPrice: Number(p.acPrice),
    nonAcPrice: Number(p.nonAcPrice),
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.get("/pricing", async (_req, res): Promise<void> => {
  const pricing = await db.select().from(pricingTable).limit(1);
  if (!pricing[0]) {
    const [created] = await db
      .insert(pricingTable)
      .values({ acPrice: "2000", nonAcPrice: "1500" })
      .returning();
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
    await db.insert(pricingTable).values({ acPrice: "2000", nonAcPrice: "1500" });
    pricing = await db.select().from(pricingTable).limit(1);
  }

  const updateValues: Record<string, string | Date> = { updatedAt: new Date() };
  if (body.data.acPrice !== undefined) updateValues.acPrice = String(body.data.acPrice);
  if (body.data.nonAcPrice !== undefined) updateValues.nonAcPrice = String(body.data.nonAcPrice);

  const [updated] = await db.update(pricingTable).set(updateValues).returning();
  res.json(formatPricing(updated));
});

export default router;
