import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  seatId: integer("seat_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  month: text("month").notNull(),       // YYYY-MM start month
  endMonth: text("end_month").notNull(), // YYYY-MM last month of booking
  durationMonths: integer("duration_months").notNull().default(1), // 1,2,3,6
  startDay: integer("start_day"),       // Day of month (1-31) the booking starts
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending | confirmed | cancelled
  paymentDate: text("payment_date"),    // YYYY-MM-DD when payment was confirmed
  paymentSessionId: text("payment_session_id"),
  razorpayOrderId: text("razorpay_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({ id: true, createdAt: true });
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;
