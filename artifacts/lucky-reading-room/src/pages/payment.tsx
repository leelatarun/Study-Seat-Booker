import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBooking, useInitiatePayment, useConfirmPayment, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    const d = val.replace(/\D/g, "").slice(0, 4);
    return d.length >= 3 ? d.slice(0, 2) + "/" + d.slice(2) : d;
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
        <div className="text-gray-400">Loading payment details...</div>
      </div>
    );
  }

  if (booking.status === "confirmed") {
    navigate(`/confirmation/${booking.id}`);
    return null;
  }

  const isMultiMonth = booking.durationMonths > 1;

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
                <p className="text-sm text-gray-400 mt-0.5">
                  {isMultiMonth
                    ? `${monthLabel(booking.month)} → ${monthLabel(booking.endMonth)} (${booking.durationMonths} months)`
                    : monthLabel(booking.month)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">₹{Number(booking.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-400">total</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePay} className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Card Details</p>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Demo Mode</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={card.number}
                onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                required
                className="bg-gray-50 font-mono tracking-wider"
                autoComplete="cc-number"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cardName">Name on Card</Label>
              <Input
                id="cardName"
                placeholder="As printed on card"
                value={card.name}
                onChange={(e) => setCard({ ...card, name: e.target.value })}
                required
                className="bg-gray-50"
                autoComplete="cc-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="expiry">Expiry</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={card.expiry}
                  onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                  required
                  maxLength={5}
                  className="bg-gray-50 font-mono"
                  autoComplete="cc-exp"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="•••"
                  value={card.cvv}
                  onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  required
                  maxLength={4}
                  className="bg-gray-50 font-mono"
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
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

            <p className="text-center text-xs text-gray-400">
              Demo payment — no real charges made.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
