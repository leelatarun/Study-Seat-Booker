import { useState } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { useGetSeat, useCreateBooking, useGetPricing, getGetSeatQueryKey, getGetPricingQueryKey } from "@workspace/api-client-react";
import { format, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DURATION_OPTIONS = [
  { value: 1, label: "1 Month" },
  { value: 2, label: "2 Months" },
  { value: 3, label: "3 Months" },
  { value: 6, label: "6 Months" },
];

const getMonths = () => {
  const baseDate = new Date(2026, 6, 1);
  return Array.from({ length: 6 }).map((_, i) => {
    const date = addMonths(baseDate, i);
    return { value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy") };
  });
};

function addMonthsToYYYYMM(month: string, count: number): string {
  const [y, m] = month.split("-").map(Number);
  const totalMonths = y * 12 + m - 1 + count - 1;
  const endYear = Math.floor(totalMonths / 12);
  const endMon = (totalMonths % 12) + 1;
  return `${endYear}-${String(endMon).padStart(2, "0")}`;
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function Book() {
  const { seatId } = useParams<{ seatId: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const defaultMonth = params.get("month") ?? getMonths()[0].value;
  const id = parseInt(seatId ?? "0", 10);

  const { data: seat, isLoading } = useGetSeat(id, {
    query: { enabled: !!id, queryKey: getGetSeatQueryKey(id) },
  });
  const { data: pricing } = useGetPricing({
    query: { queryKey: getGetPricingQueryKey() },
  });

  const createBooking = useCreateBooking();
  const months = getMonths();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    month: defaultMonth,
    duration: 1,
  });
  const [error, setError] = useState("");

  const getPrice = (duration: number, isAc: boolean) => {
    if (!pricing) return isAc ? 2000 : 1500;
    if (isAc) {
      if (duration === 2) return pricing.acPrice2m;
      if (duration === 3) return pricing.acPrice3m;
      if (duration === 6) return pricing.acPrice6m;
      return pricing.acPrice1m;
    } else {
      if (duration === 2) return pricing.nonAcPrice2m;
      if (duration === 3) return pricing.nonAcPrice3m;
      if (duration === 6) return pricing.nonAcPrice6m;
      return pricing.nonAcPrice1m;
    }
  };

  const isAc = seat?.isAC ?? false;
  const selectedPrice = getPrice(form.duration, isAc);
  const endMonth = addMonthsToYYYYMM(form.month, form.duration);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!seat) return;

    createBooking.mutate(
      {
        data: {
          seatId: seat.id,
          customerName: form.name,
          customerPhone: form.phone,
          customerEmail: form.email || undefined,
          month: form.month,
          durationMonths: form.duration,
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
                <p className="text-2xl font-bold text-primary">₹{selectedPrice.toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-400">for {form.duration} month{form.duration > 1 ? "s" : ""}</p>
              </div>
            </div>
          </div>

          {/* Duration picker with pricing tiles */}
          <div className="p-6 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Choose Duration</p>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => {
                const p = getPrice(opt.value, isAc);
                const active = form.duration === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, duration: opt.value })}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <p className={`text-xs font-semibold mb-1 ${active ? "text-primary" : "text-gray-500"}`}>
                      {opt.label}
                    </p>
                    <p className={`text-sm font-bold ${active ? "text-primary" : "text-gray-700"}`}>
                      ₹{p.toLocaleString("en-IN")}
                    </p>
                  </button>
                );
              })}
            </div>
            {form.duration > 1 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                {monthLabel(form.month)} → {monthLabel(endMonth)}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="month">Start Month</Label>
              <Select value={form.month} onValueChange={(v) => setForm({ ...form, month: v })}>
                <SelectTrigger className="bg-gray-50 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Processing..." : `Pay ₹${selectedPrice.toLocaleString("en-IN")} →`}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
