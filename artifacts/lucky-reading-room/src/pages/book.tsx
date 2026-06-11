import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useGetSeat, useCreateBooking, getGetSeatQueryKey } from "@workspace/api-client-react";
import { format, addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const getMonths = () => {
  const baseDate = new Date(2026, 6, 1);
  return Array.from({ length: 6 }).map((_, i) => {
    const date = addMonths(baseDate, i);
    return { value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy") };
  });
};

export default function Book() {
  const { seatId } = useParams<{ seatId: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(seatId ?? "0", 10);

  const { data: seat, isLoading } = useGetSeat(id, {
    query: { enabled: !!id, queryKey: getGetSeatQueryKey(id) },
  });

  const createBooking = useCreateBooking();
  const months = getMonths();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    month: months[0].value,
  });
  const [error, setError] = useState("");

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
        },
      },
      {
        onSuccess: (booking) => {
          navigate(`/payment/${booking.id}`);
        },
        onError: (err: any) => {
          setError(
            err?.data?.error ?? "This seat is already booked for the selected month. Please choose another."
          );
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-muted-foreground">Loading seat details...</div>
      </div>
    );
  }

  if (!seat) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Seat not found.</p>
          <Button variant="outline" onClick={() => navigate("/")}>Back to Home</Button>
        </div>
      </div>
    );
  }

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
          Back to Seat Selection
        </button>

        <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-2xl">
          <div className="bg-primary/10 border-b border-primary/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Selected Cabin</p>
                <h2 className="text-2xl font-bold text-foreground">Seat {seat.seatNumber}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {seat.section === "AC" ? "AC Section" : "Non-AC Section"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Rent</p>
                <p className="text-2xl font-bold text-primary">
                  ₹{seat.price?.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="month">Booking Month</Label>
              <Select value={form.month} onValueChange={(v) => setForm({ ...form, month: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                placeholder="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                minLength={10}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-background"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? "Processing..." : "Proceed to Payment"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
