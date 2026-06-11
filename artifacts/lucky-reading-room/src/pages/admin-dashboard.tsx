import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, addMonths } from "date-fns";
import {
  useListBookings,
  useListSeats,
  useGetBookingSummary,
  useGetPricing,
  useUpdateSeat,
  useUpdatePricing,
  useUpdateBooking,
  getListBookingsQueryKey,
  getListSeatsQueryKey,
  getGetBookingSummaryQueryKey,
  getGetPricingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const getMonths = () => {
  const base = new Date(2026, 6, 1);
  return Array.from({ length: 12 }).map((_, i) => {
    const d = addMonths(base, i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });
};

const HEADERS = ["x-admin-token", "admin123"] as const;

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) navigate("/admin");
  }, []);

  const months = getMonths();
  const [month, setMonth] = useState(months[0].value);
  const [pricingEdit, setPricingEdit] = useState({ ac: "", nonAc: "" });
  const [pricingOpen, setPricingOpen] = useState(false);

  const { data: summary } = useGetBookingSummary(
    { month },
    { query: { queryKey: getGetBookingSummaryQueryKey({ month }) } }
  );
  const { data: bookings = [], isLoading: bookingsLoading } = useListBookings(
    { month },
    { query: { queryKey: getListBookingsQueryKey({ month }) } }
  );
  const { data: seats = [] } = useListSeats(
    { month },
    { query: { queryKey: getListSeatsQueryKey({ month }) } }
  );
  const { data: pricing } = useGetPricing({
    query: { queryKey: getGetPricingQueryKey() },
  });

  const updateSeat = useUpdateSeat();
  const updatePricing = useUpdatePricing();
  const updateBooking = useUpdateBooking();

  const handleToggleMaintenance = (seatId: number, current: boolean) => {
    updateSeat.mutate(
      { id: seatId, data: { isUnderMaintenance: !current }, headers: { "x-admin-token": "admin123" } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({ month }) });
        },
      }
    );
  };

  const handleUpdatePricing = () => {
    updatePricing.mutate(
      {
        data: {
          acPrice: pricingEdit.ac ? Number(pricingEdit.ac) : undefined,
          nonAcPrice: pricingEdit.nonAc ? Number(pricingEdit.nonAc) : undefined,
        },
        headers: { "x-admin-token": "admin123" } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() });
          setPricingOpen(false);
          setPricingEdit({ ac: "", nonAc: "" });
        },
      }
    );
  };

  const handleCancelBooking = (bookingId: number) => {
    updateBooking.mutate(
      { id: bookingId, data: { status: "cancelled" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({ month }) });
          queryClient.invalidateQueries({ queryKey: getGetBookingSummaryQueryKey({ month }) });
        },
      }
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin");
  };

  const monthLabel = months.find((m) => m.value === month)?.label ?? month;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Lucky Reading Room — Booking Management</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Sign Out
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-52">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPricingOpen(!pricingOpen)}>
          Edit Pricing
        </Button>
      </div>

      {pricingOpen && pricing && (
        <div className="mb-6 border border-primary/30 rounded-xl p-5 bg-card">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Update Pricing</h3>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="space-y-1">
              <Label className="text-xs">AC Section (₹)</Label>
              <Input
                type="number"
                placeholder={String(pricing.acPrice)}
                value={pricingEdit.ac}
                onChange={(e) => setPricingEdit({ ...pricingEdit, ac: e.target.value })}
                className="bg-background h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Non-AC Section (₹)</Label>
              <Input
                type="number"
                placeholder={String(pricing.nonAcPrice)}
                value={pricingEdit.nonAc}
                onChange={(e) => setPricingEdit({ ...pricingEdit, nonAc: e.target.value })}
                className="bg-background h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleUpdatePricing} disabled={updatePricing.isPending}>
              {updatePricing.isPending ? "Saving..." : "Save Pricing"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPricingOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Seats", value: summary.totalSeats },
            { label: "Booked", value: summary.bookedSeats, accent: true },
            { label: "Available", value: summary.availableSeats },
            { label: "Revenue", value: `₹${Number(summary.revenue).toLocaleString("en-IN")}`, accent: true },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.accent ? "text-primary" : "text-foreground"}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">{monthLabel} — Bookings ({bookings.length})</h2>
          </div>
          {bookingsLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No bookings for this month.</div>
          ) : (
            <div className="divide-y divide-border max-h-96 overflow-y-auto">
              {bookings.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground">Seat {b.seatNumber}</span>
                      <span className="text-xs text-muted-foreground">{b.section === "AC" ? "AC" : "Non-AC"}</span>
                      <Badge
                        variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}
                        className="text-xs px-1.5 py-0"
                      >
                        {b.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{b.customerName} · {b.customerPhone}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</span>
                    {b.status === "confirmed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleCancelBooking(b.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground text-sm">Seat Maintenance Control</h2>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {seats.map((seat) => (
              <div key={seat.id} className="px-5 py-3 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Seat {seat.seatNumber}</span>
                    <span className="text-xs text-muted-foreground">{seat.section === "AC" ? "AC" : "Non-AC"}</span>
                    {seat.bookedForMonth && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">Booked</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {seat.isUnderMaintenance && (
                    <span className="text-xs text-amber-400">Maintenance</span>
                  )}
                  <Switch
                    checked={seat.isUnderMaintenance}
                    onCheckedChange={() => handleToggleMaintenance(seat.id, seat.isUnderMaintenance)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
