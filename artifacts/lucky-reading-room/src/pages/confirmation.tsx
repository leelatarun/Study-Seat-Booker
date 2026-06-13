import { useParams, useLocation } from "wouter";
import { useGetBooking, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

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

function nextStartDate(endDate: string): string {
  const [y, m, d] = endDate.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function nextEndDate(endDate: string): string {
  const [y, m, d] = endDate.split("-").map(Number);
  const next = new Date(y, m, d); // same day next month approx
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
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

  const isPending = booking.status === "pending";
  const receiptRef = "print-area";

  const hasDateRange = booking.startDate && booking.endDate;
  const validFromStr = hasDateRange ? formatDate(booking.startDate) : monthLabel(booking.month);
  const validUntilStr = hasDateRange ? formatDate(booking.endDate) : monthLabel(booking.endMonth);

  const paymentDateStr = booking.paymentDate
    ? formatDate(booking.paymentDate)
    : new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const renewStart = hasDateRange ? nextStartDate(booking.endDate!) : undefined;
  const renewEnd = hasDateRange ? nextEndDate(booking.endDate!) : undefined;

  return (
    <>
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
            {/* Status banner */}
            {isPending ? (
              <div className="p-8 text-center border-b border-gray-100 bg-amber-50 print:bg-amber-50">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 border-2 border-amber-200 mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-1">Booking Submitted!</h1>
                <p className="text-amber-700 text-sm font-medium">Awaiting payment confirmation</p>
                <p className="text-gray-500 text-xs mt-1">Lucky Reading Room — SR Nagar, Hyderabad</p>
              </div>
            ) : (
              <div className="p-8 text-center border-b border-gray-100 bg-green-50 print:bg-green-50">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 border-2 border-green-200 mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-1">Booking Confirmed!</h1>
                <p className="text-gray-500 text-sm">Lucky Reading Room — SR Nagar, Hyderabad</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* Pending notice */}
              {isPending && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-semibold mb-1">What happens next?</p>
                  <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                    <li>Share your UPI payment screenshot with the admin on WhatsApp</li>
                    <li>Admin will verify and confirm your booking</li>
                    <li>You'll receive confirmation on your phone</li>
                  </ol>
                </div>
              )}

              {/* Booking details */}
              <div className="bg-gray-50 rounded-xl p-5 space-y-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Booking Receipt</p>
                  {!isPending && <p className="text-xs text-gray-300">{paymentDateStr}</p>}
                </div>
                {[
                  { label: "Booking ID", value: `#${booking.id.toString().padStart(6, "0")}` },
                  { label: "Cabin", value: `Seat ${booking.seatNumber}` },
                  { label: "Section", value: booking.section === "AC" ? "AC (Room 1)" : "Non-AC" },
                  { label: "From", value: validFromStr },
                  { label: "Until", value: validUntilStr },
                  ...(booking.paymentDate && !isPending ? [{ label: "Confirmed On", value: paymentDateStr }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{label}</span>
                    <span className="font-semibold text-gray-700">{value}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                  <span className="text-gray-500 text-sm">{isPending ? "Amount Due" : "Amount Paid"}</span>
                  <span className="text-xl font-bold text-primary">₹{Number(booking.amount).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Student info */}
              <div className={`border rounded-xl p-4 ${isPending ? "bg-amber-50 border-amber-100" : "bg-green-50 border-green-100"}`}>
                <p className="font-semibold text-gray-700 text-sm mb-2">Student Details</p>
                <p className="text-sm text-gray-600">{booking.customerName}</p>
                <p className="text-sm text-gray-500">{booking.customerPhone}</p>
                {booking.customerEmail && (
                  <p className="text-sm text-gray-500">{booking.customerEmail}</p>
                )}
              </div>

              {!isPending && (
                <div className="text-center text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                  Show this receipt when you arrive. Your cabin is reserved until {validUntilStr}.
                </div>
              )}

              <div className="flex flex-col gap-3">
                {/* Renew CTA — only for confirmed */}
                {!isPending && hasDateRange && renewStart && renewEnd && (
                  <Button
                    className="w-full h-11 text-base font-semibold gap-2 bg-primary hover:bg-primary/90"
                    onClick={() => {
                      const qs = new URLSearchParams({
                        startDate: renewStart,
                        endDate: renewEnd,
                        name: booking.customerName,
                        phone: booking.customerPhone,
                        ...(booking.customerEmail ? { email: booking.customerEmail } : {}),
                      });
                      navigate(`/book/${booking.seatId}?${qs.toString()}`);
                    }}
                  >
                    Renew for Next Month
                  </Button>
                )}

                <div className="flex gap-3">
                  {!isPending && (
                    <Button
                      variant="outline"
                      className="flex-1 gap-2"
                      onClick={() => window.print()}
                    >
                      <Printer className="w-4 h-4" />
                      Print Receipt
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className={isPending ? "w-full" : "flex-1"}
                    onClick={() => navigate("/")}
                  >
                    {isPending ? "Back to Home" : "Book Another Cabin"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
