import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const seatsTable = pgTable("seats", {
  id: integer("id").primaryKey(),
  seatNumber: integer("seat_number").notNull(),
  section: text("section").notNull(), // "AC" or "NON_AC"
  room: integer("room").notNull().default(1), // 1=AC, 2=Non-AC/AC-switchable, 3=Common
  isAC: boolean("is_ac").notNull().default(false),
  isOfflineBooked: boolean("is_offline_booked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSeatSchema = createInsertSchema(seatsTable).omit({ createdAt: true });
export type InsertSeat = z.infer<typeof insertSeatSchema>;
export type Seat = typeof seatsTable.$inferSelect;
