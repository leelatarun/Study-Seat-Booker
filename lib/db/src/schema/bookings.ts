import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  seatId: integer("seat_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  startDate: text("start_date"),               // YYYY-MM-DD — primary date fields
  endDate: text("end_date"),                   // YYYY-MM-DD — primary date fields
  month: text("month").notNull(),              // YYYY-MM derived from startDate (kept for query compat)
  endMonth: text("end_month").notNull(),       // YYYY-MM derived from endDate
  durationMonths: integer("duration_months").notNull().default(1),
  startDay: integer("start_day"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed | cancelled
  paymentDate: text("payment_date"),
  paymentSessionId: text("payment_session_id"),
  razorpayOrderId: text("razorpay_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
