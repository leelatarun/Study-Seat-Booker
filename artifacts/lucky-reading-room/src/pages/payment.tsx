import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBooking, useInitiatePayment, useConfirmPayment, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Payment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(bookingId ?? "0", 10);

  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) },
  });

  const initiatePayment = useInitiatePayment();
  const confirmPayment = useConfirmPayment();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [error, setError] = useState("");
  const [initiated, setInitiated] = useState(false);

  useEffect(() => {
    if (booking && !initiated) {
      setInitiated(true);
      initiatePayment.mutate(
        { data: { bookingId: booking.id } },
        {
          onSuccess: (session) => setSessionId(session.sessionId),
          onError: () => setError("Could not initiate payment. Please try again."),
        }
      );
    }
  }, [booking, initiated]);

  const formatCardNumber = (val: string) =>
    val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !booking) return;
    setError("");

    confirmPayment.mutate(
      {
        data: {
          sessionId,
          bookingId: booking.id,
          cardNumber: card.number.replace(/\s/g, ""),
          cardName: card.name,
          expiry: card.expiry,
          cvv: card.cvv,
        },
      },
      {
        onSuccess: () => navigate(`/confirmation/${booking.id}`),
        onError: () => setError("Payment failed. Please check your card details and try again."),
      }
    );
  };

  if (isLoading || !booking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading payment details...</div>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    navigate(`/confirmation/${booking.id}`);
    return null;
  }

  const monthLabel = (() => {
    const [y, m] = booking.month.split("-");
    return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  })();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </button>

        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-2xl">
          <div className="bg-primary/10 border-b border-primary/20 p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Order Summary</p>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-foreground">Seat {booking.seatNumber} — {booking.section === "AC" ? "AC Section" : "Non-AC Section"}</p>
                <p className="text-sm text-muted-foreground mt-1">{monthLabel} · {booking.customerName}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">₹{Number(booking.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePay} className="p-6 space-y-5">
            <div>
              <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Card Details
                <span className="ml-auto text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Demo Mode</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                required
                className="bg-background font-mono tracking-wider"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cardName">Name on Card</Label>
              <Input
                id="cardName"
                placeholder="As printed on card"
                value={card.name}
                onChange={(e) => setCard({ ...card, name: e.target.value })}
                required
                className="bg-background"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={card.expiry}
                  onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  required
                  maxLength={5}
                  className="bg-background font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="•••"
                  value={card.cvv}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  required
                  maxLength={4}
                  className="bg-background font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={confirmPayment.isPending || !sessionId}
            >
              {confirmPayment.isPending
                ? "Processing..."
                : `Pay ₹${Number(booking.amount).toLocaleString("en-IN")}`}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              This is a demo payment. No real charges will be made.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
