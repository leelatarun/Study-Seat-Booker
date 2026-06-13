import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBooking, useInitiatePayment, getGetBookingQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Payment() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(bookingId ?? "0", 10);

  const { data: booking, isLoading } = useGetBooking(id, {
    query: { enabled: !!id, queryKey: getGetBookingQueryKey(id) },
  });

  const initiatePayment = useInitiatePayment();

  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const initiated = useRef(false);

  useEffect(() => {
    loadRazorpayScript().then(setScriptReady);
  }, []);

  useEffect(() => {
    if (booking && !initiated.current) {
      initiated.current = true;
      initiatePayment.mutate({ data: { bookingId: booking.id } }, {
        onError: () => {},
      });
    }
  }, [booking]);

  const handlePay = async () => {
    if (!booking || !scriptReady) return;
    setError("");
    setPaying(true);

    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create order");
      }
      const { orderId, amount, currency, keyId } = await res.json();

      await new Promise<void>((resolve, reject) => {
        const options = {
          key: keyId,
          amount,
          currency,
          name: "Lucky Reading Room",
          description: `Cabin ${booking.seatNumber} — ${monthLabel(booking.month)}`,
          order_id: orderId,
          prefill: {
            name: booking.customerName,
            contact: booking.customerPhone,
            email: booking.customerEmail ?? "",
          },
          theme: { color: "#16a34a" },
          // Explicitly surface UPI, Credit Card, Debit Card
          config: {
            display: {
              blocks: {
                upi: {
                  name: "UPI",
                  instruments: [{ method: "upi" }],
                },
                credit: {
                  name: "Credit Card",
                  instruments: [{ method: "card", types: ["credit"] }],
                },
                debit: {
                  name: "Debit Card",
                  instruments: [{ method: "card", types: ["debit"] }],
                },
              },
              sequence: ["block.upi", "block.credit", "block.debit"],
              preferences: { show_default_blocks: false },
            },
          },
          modal: {
            ondismiss: () => reject(new Error("cancelled")),
          },
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const vRes = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  bookingId: booking.id,
                }),
              });
              if (!vRes.ok) {
                const err = await vRes.json().catch(() => ({}));
                reject(new Error(err.error ?? "Verification failed"));
              } else {
                resolve();
              }
            } catch (e) {
              reject(e);
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response: any) => {
          reject(new Error(response.error?.description ?? "Payment failed"));
        });
        rzp.open();
      });

      navigate(`/confirmation/${booking.id}`);
    } catch (err: any) {
      if (err?.message === "cancelled") {
        setError("Payment was cancelled. You can try again.");
      } else {
        setError(err?.message ?? "Payment failed. Please try again.");
      }
    } finally {
      setPaying(false);
    }
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

          <div className="p-6 space-y-5">
            {/* Payment method icons */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex items-center gap-3">
                {/* UPI */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                    <svg viewBox="0 0 48 48" className="w-7 h-7" fill="none">
                      <rect width="48" height="48" rx="8" fill="#6C47FF" opacity="0.1"/>
                      <path d="M24 8L14 24l10 16 10-16-10-16z" fill="#6C47FF"/>
                      <path d="M24 8l10 16H14L24 8z" fill="#9F7FFF" opacity="0.6"/>
                    </svg>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">UPI</span>
                </div>
                {/* Credit Card */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                      <rect x="1" y="4" width="22" height="16" rx="3" stroke="#3B82F6" strokeWidth="1.5"/>
                      <path d="M1 10h22" stroke="#3B82F6" strokeWidth="1.5"/>
                      <rect x="4" y="14" width="4" height="2" rx="0.5" fill="#3B82F6"/>
                    </svg>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Credit</span>
                </div>
                {/* Debit Card */}
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                      <rect x="1" y="4" width="22" height="16" rx="3" stroke="#16a34a" strokeWidth="1.5"/>
                      <path d="M1 10h22" stroke="#16a34a" strokeWidth="1.5"/>
                      <rect x="4" y="14" width="4" height="2" rx="0.5" fill="#16a34a"/>
                    </svg>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium">Debit</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">Powered by Razorpay</p>
            </div>

            {/* Booking summary */}
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Booking for</span>
                <span className="font-medium">{booking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cabin</span>
                <span className="font-medium">#{booking.seatNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Period</span>
                <span className="font-medium">
                  {isMultiMonth
                    ? `${booking.durationMonths} months`
                    : monthLabel(booking.month)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="font-bold text-primary text-base">₹{Number(booking.amount).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={handlePay}
              disabled={paying || !scriptReady}
            >
              {paying ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Opening Payment...
                </>
              ) : (
                <>Pay ₹{Number(booking.amount).toLocaleString("en-IN")} →</>
              )}
            </Button>

            <p className="text-center text-xs text-gray-400">
              Secured by Razorpay · 256-bit SSL encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
