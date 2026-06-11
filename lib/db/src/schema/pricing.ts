import { pgTable, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pricingTable = pgTable("pricing", {
  id: serial("id").primaryKey(),
  acPrice1m: integer("ac_price_1m").notNull().default(2000),
  acPrice2m: integer("ac_price_2m").notNull().default(3800),
  acPrice3m: integer("ac_price_3m").notNull().default(5600),
  acPrice6m: integer("ac_price_6m").notNull().default(11000),
  nonAcPrice1m: integer("non_ac_price_1m").notNull().default(1500),
  nonAcPrice2m: integer("non_ac_price_2m").notNull().default(2800),
  nonAcPrice3m: integer("non_ac_price_3m").notNull().default(4100),
  nonAcPrice6m: integer("non_ac_price_6m").notNull().default(8000),
  room2IsAc: boolean("room2_is_ac").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPricingSchema = createInsertSchema(pricingTable).omit({ id: true, updatedAt: true });
export type InsertPricing = z.infer<typeof insertPricingSchema>;
export type Pricing = typeof pricingTable.$inferSelect;
