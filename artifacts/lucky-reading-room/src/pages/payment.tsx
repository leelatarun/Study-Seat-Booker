import { useParams, useLocation } from "wouter";
import { useGetBooking, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import upiQrCode from "@assets/upi_qr_code_1781343450966.jpg";

const UPI_ID = "9014463623@okbizaxis";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function Payment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(bookingId ?? "0", 10);

  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) },
  });

  if (isLoading || !booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-gray-400">Loading payment details...</div>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    navigate(`/confirmation/${booking.id}`);
    return null;
  }

  const periodStr = booking.startDate && booking.endDate
    ? `${formatDate(booking.startDate)} → ${formatDate(booking.endDate)}`
    : booking.durationMonths > 1
    ? `${monthLabel(booking.month)} → ${monthLabel(booking.endMonth)}`
    : monthLabel(booking.month);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-gray-400 hover:text-gray-700 mb-6 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>

        <div className="rounded-2xl overflow-hidden bg-white shadow-md border border-gray-100">
          {/* Order summary */}
          <div className="bg-green-50 border-b border-green-100 p-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Order Summary</p>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-800">
                  Seat {booking.seatNumber} — {booking.section === "AC" ? "AC" : "Non-AC"}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{booking.customerName}</p>
                <p className="text-sm text-gray-400 mt-0.5">{periodStr}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">₹{Number(booking.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-400">total</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* UPI payment instructions */}
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">Pay via UPI</p>
              <p className="text-xs text-gray-400 mb-4">Scan the QR code or use the UPI ID below</p>

              <div className="flex justify-center mb-4">
                <div className="border-2 border-gray-200 rounded-xl p-2 bg-white shadow-sm inline-block">
                  <img
                    src={upiQrCode}
                    alt="UPI QR Code"
                    className="w-48 h-48 object-contain rounded-lg"
                  />
                </div>
              </div>

              <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mb-2">
                <span className="text-sm font-mono font-semibold text-gray-800">{UPI_ID}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(UPI_ID)}
                  className="text-gray-400 hover:text-primary transition-colors"
                  title="Copy UPI ID"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-400">Lucky Reading Room</p>
            </div>

            {/* Booking summary */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="font-medium">{booking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cabin</span>
                <span className="font-medium">#{booking.seatNumber} ({booking.section === "AC" ? "AC" : "Non-AC"})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Period</span>
                <span className="font-medium text-right max-w-[55%]">{periodStr}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-700">Amount to Pay</span>
                <span className="font-bold text-primary text-base">₹{Number(booking.amount).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 space-y-1">
              <p className="font-semibold flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                After paying, notify the admin
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Send your payment screenshot to the admin on WhatsApp. Your booking will be confirmed once the payment is verified.
              </p>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold gap-2 bg-primary hover:bg-primary/90"
              onClick={() => navigate(`/confirmation/${booking.id}`)}
            >
              I've Paid — View Booking
            </Button>

            <p className="text-center text-xs text-gray-400">
              Booking ID #{booking.id.toString().padStart(6, "0")} · Pending admin confirmation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
