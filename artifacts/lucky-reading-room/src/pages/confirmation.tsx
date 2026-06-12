import { useParams, useLocation } from "wouter";
import { useGetBooking, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function Confirmation() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(bookingId ?? "0", 10);

  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-gray-400">Loading confirmation...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Booking not found.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const isMultiMonth = booking.durationMonths > 1;
  const receiptRef = "print-area";

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #${receiptRef} { display: block !important; }
          #${receiptRef} * { -webkit-print-color-adjust: exact; color-adjust: exact; }
        }
      `}</style>

      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-gray-50">
        <div className="w-full max-w-lg">
          <div id={receiptRef} className="rounded-2xl overflow-hidden bg-white shadow-md border border-gray-100">
            {/* Success banner */}
            <div className="p-8 text-center border-b border-gray-100 bg-green-50 print:bg-green-50">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 border-2 border-green-200 mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-1">Booking Confirmed!</h1>
              <p className="text-gray-500 text-sm">Lucky Reading Room — SR Nagar, Hyderabad</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Booking details */}
              <div className="bg-gray-50 rounded-xl p-5 space-y-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Booking Receipt</p>
                  <p className="text-xs text-gray-300">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                {[
                  { label: "Booking ID", value: `#${booking.id.toString().padStart(6, "0")}` },
                  { label: "Cabin", value: `Seat ${booking.seatNumber}` },
                  { label: "Section", value: booking.section === "AC" ? "AC (Room 1)" : "Non-AC" },
                  {
                    label: isMultiMonth ? "Period" : "Month",
                    value: isMultiMonth
                      ? `${monthLabel(booking.month)} → ${monthLabel(booking.endMonth)}`
                      : monthLabel(booking.month),
                  },
                  ...(isMultiMonth ? [{ label: "Duration", value: `${booking.durationMonths} months` }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-semibold text-gray-700">{value}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Amount Paid</span>
                  <span className="text-xl font-bold text-primary">₹{Number(booking.amount).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Student info */}
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <p className="font-semibold text-gray-700 text-sm mb-2">Student Details</p>
                <p className="text-sm text-gray-600">{booking.customerName}</p>
                <p className="text-sm text-gray-500">{booking.customerPhone}</p>
                {booking.customerEmail && (
                  <p className="text-sm text-gray-500">{booking.customerEmail}</p>
                )}
              </div>

              <div className="text-center text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                Show this receipt when you arrive. Your cabin will be available again after the booked period ends.
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
                <Button className="flex-1" onClick={() => navigate("/")}>
                  Book Another Cabin
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
