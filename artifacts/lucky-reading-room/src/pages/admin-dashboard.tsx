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

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) navigate("/admin");
  }, []);

  const months = getMonths();
  const [month, setMonth] = useState(months[0].value);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [pricingEdit, setPricingEdit] = useState({
    acPrice1m: "", acPrice2m: "", acPrice3m: "", acPrice6m: "",
    nonAcPrice1m: "", nonAcPrice2m: "", nonAcPrice3m: "", nonAcPrice6m: "",
  });

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

  const adminReq = { headers: { "x-admin-token": "admin123" } } as RequestInit;
  const updateSeat = useUpdateSeat({ request: adminReq });
  const updatePricing = useUpdatePricing({ request: adminReq });
  const updateBooking = useUpdateBooking();

  const handleToggleOffline = (seatId: number, current: boolean) => {
    updateSeat.mutate(
      { id: seatId, data: { isOfflineBooked: !current } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({ month }) });
        },
      }
    );
  };

  const handleToggleRoom2 = (makeAc: boolean) => {
    updatePricing.mutate(
      { data: { room2IsAc: makeAc } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({ month }) });
        },
      }
    );
  };

  const handleUpdatePricing = () => {
    const patch: Record<string, number> = {};
    const fields = [
      "acPrice1m", "acPrice2m", "acPrice3m", "acPrice6m",
      "nonAcPrice1m", "nonAcPrice2m", "nonAcPrice3m", "nonAcPrice6m",
    ] as const;
    for (const f of fields) {
      if (pricingEdit[f]) patch[f] = Number(pricingEdit[f]);
    }
    if (Object.keys(patch).length === 0) return;

    updatePricing.mutate(
      { data: patch },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() });
          setPricingOpen(false);
          setPricingEdit({ acPrice1m:"", acPrice2m:"", acPrice3m:"", acPrice6m:"", nonAcPrice1m:"", nonAcPrice2m:"", nonAcPrice3m:"", nonAcPrice6m:"" });
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Lucky Reading Room — Booking Management</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { localStorage.removeItem("adminToken"); navigate("/admin"); }}
        >
          Sign Out
        </Button>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-52">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="bg-white border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Room 2 AC/Non-AC toggle */}
        {pricing && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">Room 2:</span>
            <Select
              value={pricing.room2IsAc ? "ac" : "nonac"}
              onValueChange={(v) => handleToggleRoom2(v === "ac")}
            >
              <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent p-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nonac">Non-AC</SelectItem>
                <SelectItem value="ac">AC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setPricingOpen(!pricingOpen)}>
          Edit Pricing
        </Button>
      </div>

      {/* Pricing editor */}
      {pricingOpen && pricing && (
        <div className="mb-6 border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Update Pricing</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">AC Section</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "acPrice1m" as const, label: "1 Month", cur: pricing.acPrice1m },
                  { key: "acPrice2m" as const, label: "2 Months", cur: pricing.acPrice2m },
                  { key: "acPrice3m" as const, label: "3 Months", cur: pricing.acPrice3m },
                  { key: "acPrice6m" as const, label: "6 Months", cur: pricing.acPrice6m },
                ].map(({ key, label, cur }) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-xs text-gray-400">{label}</Label>
                    <Input
                      type="number"
                      placeholder={String(cur)}
                      value={pricingEdit[key]}
                      onChange={(e) => setPricingEdit({ ...pricingEdit, [key]: e.target.value })}
                      className="bg-gray-50 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Non-AC Section</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "nonAcPrice1m" as const, label: "1 Month", cur: pricing.nonAcPrice1m },
                  { key: "nonAcPrice2m" as const, label: "2 Months", cur: pricing.nonAcPrice2m },
                  { key: "nonAcPrice3m" as const, label: "3 Months", cur: pricing.nonAcPrice3m },
                  { key: "nonAcPrice6m" as const, label: "6 Months", cur: pricing.nonAcPrice6m },
                ].map(({ key, label, cur }) => (
                  <div key={key} className="space-y-0.5">
                    <Label className="text-xs text-gray-400">{label}</Label>
                    <Input
                      type="number"
                      placeholder={String(cur)}
                      value={pricingEdit[key]}
                      onChange={(e) => setPricingEdit({ ...pricingEdit, [key]: e.target.value })}
                      className="bg-gray-50 h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleUpdatePricing} disabled={updatePricing.isPending}>
              {updatePricing.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPricingOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Seats", value: summary.totalSeats, color: "text-gray-700" },
            { label: "Booked", value: summary.bookedSeats, color: "text-primary" },
            { label: "Available", value: summary.availableSeats, color: "text-gray-700" },
            { label: "Revenue", value: `₹${Number(summary.revenue).toLocaleString("en-IN")}`, color: "text-primary" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Bookings list */}
        <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">
              {months.find(m => m.value === month)?.label} — Bookings ({bookings.length})
            </h2>
          </div>
          {bookingsLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : bookings.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No bookings for this month.</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {bookings.map((b) => (
                <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">Seat {b.seatNumber}</span>
                      <span className="text-xs text-gray-400">{b.section === "AC" ? "AC" : "Non-AC"}</span>
                      <Badge
                        variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}
                        className="text-xs px-1.5 py-0"
                      >
                        {b.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{b.customerName} · {b.customerPhone}</p>
                    {b.durationMonths > 1 && (
                      <p className="text-xs text-gray-300">{b.durationMonths}mo: {monthLabel(b.month)} → {monthLabel(b.endMonth)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</span>
                    {b.status === "confirmed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-red-400 hover:text-red-600"
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

        {/* Seat offline toggle */}
        <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">Seat Availability — Offline Bookings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toggle to mark seats booked at the admin desk</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
            {seats.map((seat) => (
              <div key={seat.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">Seat {seat.seatNumber}</span>
                    <span className="text-xs text-gray-400">{seat.section === "AC" ? "AC" : "Non-AC"}</span>
                    {seat.bookedForMonth && !seat.isOfflineBooked && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">Online</Badge>
                    )}
                    {seat.isOfflineBooked && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 text-orange-500 border-orange-200">Offline</Badge>
                    )}
                  </div>
                </div>
                <Switch
                  checked={seat.isOfflineBooked === true}
                  onCheckedChange={() => handleToggleOffline(seat.id, seat.isOfflineBooked === true)}
                  disabled={(seat.bookedForMonth && !seat.isOfflineBooked) ?? false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
