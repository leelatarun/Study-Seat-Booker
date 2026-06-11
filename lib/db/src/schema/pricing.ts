import { pgTable, serial, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pricingTable = pgTable("pricing", {
  id: serial("id").primaryKey(),
  acPrice: numeric("ac_price", { precision: 10, scale: 2 }).notNull().default("2000"),
  nonAcPrice: numeric("non_ac_price", { precision: 10, scale: 2 }).notNull().default("1500"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPricingSchema = createInsertSchema(pricingTable).omit({ id: true, updatedAt: true });
export type InsertPricing = z.infer<typeof insertPricingSchema>;
export type Pricing = typeof pricingTable.$inferSelect;
