import { useParams, useLocation } from "wouter";
import { useGetBooking, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

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
        <div className="text-muted-foreground">Loading confirmation...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Booking not found.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const monthLabel = (() => {
    const [y, m] = booking.month.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  })();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-2xl">
          <div className="p-8 text-center border-b border-border">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Booking Confirmed!</h1>
            <p className="text-muted-foreground text-sm">Your cabin is reserved and ready for you.</p>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-background rounded-xl p-5 space-y-3 border border-border">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Booking ID</span>
                <span className="font-mono font-semibold text-foreground">#{booking.id.toString().padStart(6, "0")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cabin</span>
                <span className="font-semibold text-foreground">Seat {booking.seatNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Section</span>
                <span className="font-semibold text-foreground">{booking.section === "AC" ? "AC Section" : "Non-AC Section"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Month</span>
                <span className="font-semibold text-foreground">{monthLabel}</span>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Amount Paid</span>
                <span className="text-xl font-bold text-primary">₹{Number(booking.amount).toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="font-semibold text-foreground text-sm mb-2">Student Details</p>
              <p className="text-sm text-muted-foreground">{booking.customerName}</p>
              <p className="text-sm text-muted-foreground">{booking.customerPhone}</p>
              {booking.customerEmail && (
                <p className="text-sm text-muted-foreground">{booking.customerEmail}</p>
              )}
            </div>

            <div className="text-center text-xs text-muted-foreground bg-muted rounded-lg px-4 py-3">
              Please present this booking ID when you arrive. Contact us if you have any questions.
            </div>

            <Button className="w-full" onClick={() => navigate("/")}>
              Book Another Seat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
