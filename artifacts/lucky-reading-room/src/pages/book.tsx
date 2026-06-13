import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSeat, useCreateBooking, useGetPricing, getGetSeatQueryKey, getGetPricingQueryKey } from "@workspace/api-client-react";
import { differenceInCalendarDays, parseISO, format, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDisplayDate(yyyyMmDd: string): string {
  try {
    const [y, m, d] = yyyyMmDd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return yyyyMmDd;
  }
}

function daysBetween(start: string, end: string): number {
  try {
    return Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)) + 1);
  } catch {
    return 1;
  }
}

// Read pre-filled dates from URL search params (set by seat-selector)
function getUrlDates(): { startDate: string; endDate: string; name: string; phone: string; email: string } {
  const sp = new URLSearchParams(window.location.search);
  const today = todayStr();
  const nextMonth = format(addMonths(new Date(), 1), "yyyy-MM-dd");
  return {
    startDate: sp.get("startDate") || today,
    endDate: sp.get("endDate") || nextMonth,
    name: sp.get("name") || "",
    phone: sp.get("phone") || "",
    email: sp.get("email") || "",
  };
}

export default function Book() {
  const { seatId } = useParams<{ seatId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(seatId ?? "0", 10);

  const { data: seat, isLoading } = useGetSeat(id, {
    query: { enabled: !!id, queryKey: getGetSeatQueryKey(id) },
  });
  const { data: pricing } = useGetPricing({
    query: { queryKey: getGetPricingQueryKey() },
  });

  const createBooking = useCreateBooking();

  const prefill = getUrlDates();
  const [form, setForm] = useState({
    name: prefill.name,
    phone: prefill.phone,
    email: prefill.email,
    startDate: prefill.startDate,
    endDate: prefill.endDate,
  });
  const [error, setError] = useState("");

  const monthlyRate = (() => {
    if (!pricing) return seat?.isAC ? 2000 : 1500;
    return seat?.isAC ? pricing.acPrice1m : pricing.nonAcPrice1m;
  })();

  const days = form.startDate && form.endDate && form.endDate >= form.startDate
    ? daysBetween(form.startDate, form.endDate)
    : 0;

  const totalPrice = days > 0 ? Math.round((monthlyRate / 30) * days) : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!seat) return;
    if (!form.startDate || !form.endDate) {
      setError("Please select both start and end dates.");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("End date must be on or after start date.");
      return;
    }
    if (form.startDate < todayStr()) {
      setError("Start date cannot be in the past.");
      return;
    }

    createBooking.mutate(
      {
        data: {
          seatId: seat.id,
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email || undefined,
          startDate: form.startDate,
          endDate: form.endDate,
        },
      },
      {
        onSuccess: (booking) => navigate(`/payment/${booking.id}`),
        onError: (err: any) => {
          setError(err?.data?.error ?? "This seat is already booked for the selected period. Please choose another.");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-gray-400">Loading seat details...</div>
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Seat not found.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

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
          Back to Seat Selection
        </button>

        <div className="rounded-2xl overflow-hidden bg-white shadow-md border border-gray-100">
          {/* Seat info header */}
          <div className="bg-green-50 border-b border-green-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Selected Cabin</p>
                <h2 className="text-2xl font-bold text-gray-800">Seat {seat.seatNumber}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {seat.section === "AC" ? "AC Section (Room 1)" : `${seat.room === 2 ? "Room 2" : "Common Area"}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total</p>
                <p className="text-2xl font-bold text-primary">
                  {days > 0 ? `₹${totalPrice.toLocaleString("en-IN")}` : "—"}
                </p>
                <p className="text-xs text-gray-400">
                  {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "select dates"}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing info */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">
              ₹{monthlyRate.toLocaleString("en-IN")}/month · charged daily (₹{Math.round(monthlyRate / 30)}/day)
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Date range picker */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date <span className="text-red-400">*</span></Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  min={todayStr()}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setForm((f) => ({
                      ...f,
                      startDate: newStart,
                      endDate: f.endDate < newStart ? newStart : f.endDate,
                    }));
                  }}
                  required
                  className="bg-gray-50 border-gray-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date <span className="text-red-400">*</span></Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  min={form.startDate || todayStr()}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                  className="bg-gray-50 border-gray-200"
                />
              </div>
            </div>

            {/* Validity summary */}
            {days > 0 && (
              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-xs text-green-700">
                <span className="font-medium">Period:</span>{" "}
                {formatDisplayDate(form.startDate)} → {formatDisplayDate(form.endDate)}
                {" "}<span className="text-green-500">({days} day{days !== 1 ? "s" : ""})</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name <span className="text-red-400">*</span></Label>
              <Input
                id="name"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone Number <span className="text-red-400">*</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                minLength={10}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-gray-50 border-gray-200"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={createBooking.isPending || days <= 0}
            >
              {createBooking.isPending
                ? "Submitting..."
                : days > 0
                ? `Proceed to Pay ₹${totalPrice.toLocaleString("en-IN")} →`
                : "Select dates to continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
