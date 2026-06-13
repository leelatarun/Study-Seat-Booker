import twilio from "twilio";
import nodemailer from "nodemailer";

export interface BookingNotificationData {
  bookingId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  seatNumber: number;
  section: string;
  month: string;
  endMonth: string;
  durationMonths: number;
  amount: number;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function buildSmsBody(data: BookingNotificationData): string {
  const monthStr =
    data.durationMonths > 1
      ? `${monthLabel(data.month)} – ${monthLabel(data.endMonth)}`
      : monthLabel(data.month);

  return (
    `Lucky Reading Room – Booking Confirmed!\n` +
    `Seat ${data.seatNumber} (${data.section}), ${monthStr}.\n` +
    `Amount: ₹${data.amount.toLocaleString("en-IN")}.\n` +
    `Booking ID: #${String(data.bookingId).padStart(6, "0")}.\n` +
    `SR Nagar, Hyderabad.`
  );
}

function buildEmailHtml(data: BookingNotificationData): string {
  const monthStr =
    data.durationMonths > 1
      ? `${monthLabel(data.month)} – ${monthLabel(data.endMonth)}`
      : monthLabel(data.month);

  const durationRow =
    data.durationMonths > 1
      ? `<tr><td style="color:#6b7280;padding:4px 0">Duration</td><td style="font-weight:600;text-align:right">${data.durationMonths} months</td></tr>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Booking Confirmed – Lucky Reading Room</title></head>
<body style="font-family:Arial,sans-serif;background:#f3f4f6;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#16a34a;padding:32px 24px;text-align:center">
      <div style="width:56px;height:56px;background:#dcfce7;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px">✓</div>
      <h1 style="color:#fff;margin:0;font-size:22px">Booking Confirmed!</h1>
      <p style="color:#bbf7d0;margin:6px 0 0;font-size:14px">Lucky Reading Room — SR Nagar, Hyderabad</p>
    </div>
    <div style="padding:24px">
      <p style="color:#374151;margin:0 0 16px">Hi ${data.customerName},</p>
      <p style="color:#6b7280;margin:0 0 20px;font-size:14px">Your seat has been successfully booked. Here are your booking details:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="color:#6b7280;padding:8px 0">Booking ID</td>
          <td style="font-weight:600;text-align:right">#${String(data.bookingId).padStart(6, "0")}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="color:#6b7280;padding:8px 0">Cabin / Seat</td>
          <td style="font-weight:600;text-align:right">Seat ${data.seatNumber} (${data.section})</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="color:#6b7280;padding:8px 0">Month</td>
          <td style="font-weight:600;text-align:right">${monthStr}</td>
        </tr>
        ${durationRow}
        <tr>
          <td style="color:#6b7280;padding:8px 0">Amount Paid</td>
          <td style="font-weight:700;text-align:right;font-size:18px;color:#d97706">₹${data.amount.toLocaleString("en-IN")}</td>
        </tr>
      </table>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;font-size:13px;color:#166534;text-align:center;margin-bottom:20px">
        Show this email when you arrive. Your cabin is reserved for the booked period.
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0">Lucky Reading Room · SR Nagar, Hyderabad</p>
    </div>
  </div>
</body>
</html>`;
}

function buildAdminSmsBody(data: BookingNotificationData): string {
  const monthStr =
    data.durationMonths > 1
      ? `${monthLabel(data.month)}–${monthLabel(data.endMonth)}`
      : monthLabel(data.month);
  return (
    `New Booking: Seat ${data.seatNumber} (${data.section}), ${monthStr}.\n` +
    `Customer: ${data.customerName} (${data.customerPhone}).\n` +
    `Amount: ₹${data.amount.toLocaleString("en-IN")}. ID: #${String(data.bookingId).padStart(6, "0")}`
  );
}

async function sendSms(to: string, body: string, logger?: any): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    logger?.warn("Twilio credentials not configured — skipping SMS");
    return;
  }

  const client = twilio(accountSid, authToken);
  await client.messages.create({ body, from: fromNumber, to });
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  logger?: any
): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from =
    process.env.NOTIFICATION_FROM_EMAIL ?? "noreply@luckyreadingroom.in";

  if (!host || !user || !pass) {
    logger?.warn("SMTP credentials not configured — skipping email");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({ from, to, subject, html });
}

export async function sendBookingConfirmations(
  data: BookingNotificationData,
  logger?: any
): Promise<void> {
  const tasks: Promise<void>[] = [];

  const smsBody = buildSmsBody(data);
  const emailHtml = buildEmailHtml(data);
  const emailSubject = `Booking Confirmed – Seat ${data.seatNumber}, Lucky Reading Room`;

  tasks.push(
    sendSms(data.customerPhone, smsBody, logger).catch((err) =>
      logger?.error({ err }, "Failed to send customer SMS")
    )
  );

  if (data.customerEmail) {
    tasks.push(
      sendEmail(data.customerEmail, emailSubject, emailHtml, logger).catch(
        (err) => logger?.error({ err }, "Failed to send customer email")
      )
    );
  }

  const adminPhone = process.env.ADMIN_PHONE;
  if (adminPhone) {
    tasks.push(
      sendSms(adminPhone, buildAdminSmsBody(data), logger).catch((err) =>
        logger?.error({ err }, "Failed to send admin SMS")
      )
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const adminSubject = `New Booking #${String(data.bookingId).padStart(6, "0")} – Seat ${data.seatNumber}`;
    tasks.push(
      sendEmail(adminEmail, adminSubject, emailHtml, logger).catch((err) =>
        logger?.error({ err }, "Failed to send admin email")
      )
    );
  }

  await Promise.allSettled(tasks);
}
