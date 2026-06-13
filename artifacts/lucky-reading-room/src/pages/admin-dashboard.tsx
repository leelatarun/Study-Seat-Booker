import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, addMonths, subMonths, parseISO } from "date-fns";
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
import type { Seat, Booking } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Users, LogOut, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

// Always generate from current real-time month
const getMonths = () => {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  return Array.from({ length: 24 }).map((_, i) => {
    const d = addMonths(base, i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });
};

const currentMonth = () => format(new Date(), "yyyy-MM");

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = subMonths(new Date(y, m - 1, 1), 1);
  return format(d, "yyyy-MM");
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = addMonths(new Date(y, m - 1, 1), 1);
  return format(d, "yyyy-MM");
}

function countMonthsInRange(from: string, until: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [uy, um] = until.split("-").map(Number);
  return Math.max(1, (uy - fy) * 12 + (um - fm) + 1);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return parseISO(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ──── Offline booking form ────────────────────────────────────────────────────
function OfflineForm({
  seat,
  months,
  onSave,
  onCancel,
  pricing,
}: {
  seat: Seat;
  months: { value: string; label: string }[];
  onSave: (data: { name: string; phone: string; from: string; until: string }) => void;
  onCancel: () => void;
  pricing: any;
}) {
  const [form, setForm] = useState({
    name: seat.offlineBookingName ?? "",
    phone: seat.offlineBookingPhone ?? "",
    from: seat.offlineBookingFrom ?? months[0].value,
    until: seat.offlineBookingUntil ?? months[0].value,
  });

  const numMonths = countMonthsInRange(form.from, form.until);
  const monthlyPrice = seat.isAC
    ? (pricing?.acPrice1m ?? 2000)
    : (pricing?.nonAcPrice1m ?? 1500);
  const totalPrice = numMonths * monthlyPrice;

  return (
    <div className="mt-2 p-3 rounded-lg bg-orange-50 border border-orange-100 space-y-2">
      <p className="text-xs font-medium text-orange-700">Offline booking details for Seat {seat.seatNumber}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-500">Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="h-8 text-sm bg-white"
            placeholder="Student name"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-8 text-sm bg-white"
            placeholder="Phone number"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">From</Label>
          <Select value={form.from} onValueChange={(v) => setForm({ ...form, from: v })}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-gray-500">Until</Label>
          <Select value={form.until} onValueChange={(v) => setForm({ ...form, until: v })}>
            <SelectTrigger className="h-8 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="bg-white rounded-lg px-3 py-2 border border-orange-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">{numMonths} month{numMonths !== 1 ? "s" : ""} × ₹{monthlyPrice.toLocaleString("en-IN")}/mo</span>
        <span className="text-sm font-bold text-primary">₹{totalPrice.toLocaleString("en-IN")}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave(form)}>Save</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ──── Dashboard view ──────────────────────────────────────────────────────────
function DashboardView() {
  const queryClient = useQueryClient();
  const months = getMonths();
  const [month, setMonth] = useState(currentMonth());
  const [bookingTab, setBookingTab] = useState<"confirmed" | "pending">("confirmed");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [expandedOfflineId, setExpandedOfflineId] = useState<number | null>(null);
  const [pricingEdit, setPricingEdit] = useState({
    acPrice1m: "", acPrice2m: "", acPrice3m: "", acPrice6m: "",
    nonAcPrice1m: "", nonAcPrice2m: "", nonAcPrice3m: "", nonAcPrice6m: "",
  });

  const { data: summary } = useGetBookingSummary(
    { month },
    { query: { queryKey: getGetBookingSummaryQueryKey({ month }) } }
  );
  const { data: allBookings = [], isLoading: bookingsLoading } = useListBookings(
    { month },
    { query: { queryKey: getListBookingsQueryKey({ month }) } }
  );
  const { data: seats = [] } = useListSeats(
    { month },
    { query: { queryKey: getListSeatsQueryKey({ month }) } }
  );
  const { data: pricing } = useGetPricing({ query: { queryKey: getGetPricingQueryKey() } });

  const adminReq = { headers: { "x-admin-token": "admin123" } } as RequestInit;
  const updateSeat = useUpdateSeat({ request: adminReq });
  const updatePricing = useUpdatePricing({ request: adminReq });
  const updateBooking = useUpdateBooking();

  const invalidateSeats = () => queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({ month }) });
  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({ month }) });
    queryClient.invalidateQueries({ queryKey: getGetBookingSummaryQueryKey({ month }) });
  };

  // Split bookings — filter old pending (>1 month old) out
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const confirmedBookings = allBookings.filter((b) => b.status === "confirmed");
  const pendingBookings = allBookings.filter(
    (b) => b.status === "pending" && new Date(b.createdAt) > oneMonthAgo
  );

  const displayedBookings = bookingTab === "confirmed" ? confirmedBookings : pendingBookings;

  const handleSaveOffline = (seatId: number, data: { name: string; phone: string; from: string; until: string }) => {
    updateSeat.mutate(
      {
        id: seatId,
        data: {
          isOfflineBooked: true,
          offlineBookingName: data.name || null,
          offlineBookingPhone: data.phone || null,
          offlineBookingFrom: data.from || null,
          offlineBookingUntil: data.until || null,
        },
      },
      {
        onSuccess: () => {
          setExpandedOfflineId(null);
          invalidateSeats();
          invalidateBookings();
        },
      }
    );
  };

  const handleToggleOffline = (seat: Seat) => {
    if (!seat.isOfflineBooked) {
      setExpandedOfflineId(seat.id);
    } else {
      updateSeat.mutate(
        { id: seat.id, data: { isOfflineBooked: false } },
        {
          onSuccess: () => {
            invalidateSeats();
            invalidateBookings();
          },
        }
      );
    }
  };

  const handleToggleRoom2 = (makeAc: boolean) => {
    updatePricing.mutate(
      { data: { room2IsAc: makeAc } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() });
          invalidateSeats();
        },
      }
    );
  };

  const handleUpdatePricing = () => {
    const patch: Record<string, number> = {};
    (["acPrice1m","acPrice2m","acPrice3m","acPrice6m","nonAcPrice1m","nonAcPrice2m","nonAcPrice3m","nonAcPrice6m"] as const)
      .forEach((k) => { if (pricingEdit[k]) patch[k] = Number(pricingEdit[k]); });
    if (!Object.keys(patch).length) return;
    updatePricing.mutate(
      { data: patch },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() });
          setPricingOpen(false);
          setPricingEdit({ acPrice1m:"",acPrice2m:"",acPrice3m:"",acPrice6m:"",nonAcPrice1m:"",nonAcPrice2m:"",nonAcPrice3m:"",nonAcPrice6m:"" });
        },
      }
    );
  };

  const handleCancelBooking = (bookingId: number) => {
    if (!confirm("Cancel this booking? The seat will become available again.")) return;
    updateBooking.mutate(
      { id: bookingId, data: { status: "cancelled" } },
      { onSuccess: invalidateBookings }
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Month nav + controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Month navigation */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
          <button
            onClick={() => setMonth(prevMonth(month))}
            className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(nextMonth(month))}
            className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setMonth(currentMonth())}
          className="text-xs text-primary hover:underline"
        >
          Today
        </button>

        {pricing && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
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
          <h3 className="font-semibold text-gray-700 mb-4 text-sm">Update Pricing (leave blank to keep current)</h3>
          <div className="grid grid-cols-2 gap-6">
            {[
              { label: "AC Section", keys: [
                { key: "acPrice1m" as const, label: "1 Mo", cur: pricing.acPrice1m },
                { key: "acPrice2m" as const, label: "2 Mo", cur: pricing.acPrice2m },
                { key: "acPrice3m" as const, label: "3 Mo", cur: pricing.acPrice3m },
                { key: "acPrice6m" as const, label: "6 Mo", cur: pricing.acPrice6m },
              ]},
              { label: "Non-AC Section", keys: [
                { key: "nonAcPrice1m" as const, label: "1 Mo", cur: pricing.nonAcPrice1m },
                { key: "nonAcPrice2m" as const, label: "2 Mo", cur: pricing.nonAcPrice2m },
                { key: "nonAcPrice3m" as const, label: "3 Mo", cur: pricing.nonAcPrice3m },
                { key: "nonAcPrice6m" as const, label: "6 Mo", cur: pricing.nonAcPrice6m },
              ]},
            ].map(({ label, keys }) => (
              <div key={label}>
                <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {keys.map(({ key, label: lbl, cur }) => (
                    <div key={key} className="space-y-0.5">
                      <Label className="text-xs text-gray-400">{lbl} (₹{cur})</Label>
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
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleUpdatePricing} disabled={updatePricing.isPending}>
              {updatePricing.isPending ? "Saving…" : "Save Changes"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPricingOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Seats", value: summary.totalSeats },
            { label: "Booked", value: summary.bookedSeats, highlight: true },
            { label: "Available", value: summary.availableSeats },
            { label: "Revenue", value: `₹${Number(summary.revenue).toLocaleString("en-IN")}`, highlight: true },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.highlight ? "text-primary" : "text-gray-700"}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Bookings with tabs */}
        <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700 text-sm">
                {monthLabel(month)} — Bookings
              </h2>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["confirmed", "pending"] as const).map((tab) => {
                const count = tab === "confirmed" ? confirmedBookings.length : pendingBookings.length;
                return (
                  <button
                    key={tab}
                    onClick={() => setBookingTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      bookingTab === tab
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab === "confirmed" ? "Confirmed" : "Pending"}
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                      tab === "confirmed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {bookingsLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : displayedBookings.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {bookingTab === "confirmed"
                ? "No confirmed bookings for this month."
                : "No pending bookings. Old pending bookings are automatically cleared."}
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[450px] overflow-y-auto">
              {displayedBookings.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-gray-800">Seat {b.seatNumber}</span>
                        <span className="text-xs text-gray-400">{b.section === "AC" ? "AC" : "Non-AC"}</span>
                        <Badge
                          variant={b.status === "confirmed" ? "default" : "secondary"}
                          className="text-xs px-1.5 py-0"
                        >
                          {b.status === "confirmed" ? "Paid ✓" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">{b.customerName}</p>
                      <p className="text-xs text-gray-400">{b.customerPhone}{b.customerEmail ? ` · ${b.customerEmail}` : ""}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.durationMonths > 1
                          ? `${b.durationMonths} mo: ${monthLabel(b.month)} → ${monthLabel(b.endMonth)}`
                          : monthLabel(b.month)}
                        {b.startDay && b.startDay > 1 ? ` (from ${b.startDay}th)` : ""}
                      </p>
                      {b.paymentDate && (
                        <p className="text-xs text-green-600 mt-0.5">Paid: {formatDate(b.paymentDate)}</p>
                      )}
                      {b.paymentSessionId?.startsWith("pay_") && (
                        <a
                          href={`https://dashboard.razorpay.com/app/payments/${b.paymentSessionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded px-1.5 py-0.5 transition-colors font-mono"
                        >
                          {b.paymentSessionId}
                          <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>
                      {b.status === "confirmed" && (
                        <button
                          className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors"
                          onClick={() => handleCancelBooking(b.id)}
                        >
                          Release
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offline seat manager */}
        <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700 text-sm">Offline Seat Bookings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toggle seats booked directly at the desk (counted in stats above)</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {seats.map((seat) => {
              const isOnlineBooked = seat.bookedForMonth === true && !seat.isOfflineBooked;
              const showForm = expandedOfflineId === seat.id;

              // Compute offline price for display
              let offlineAmtDisplay = "";
              if (seat.isOfflineBooked && seat.offlineBookingFrom && seat.offlineBookingUntil && pricing) {
                const n = countMonthsInRange(seat.offlineBookingFrom, seat.offlineBookingUntil);
                const monthlyPrice = seat.isAC ? pricing.acPrice1m : pricing.nonAcPrice1m;
                offlineAmtDisplay = `₹${(n * monthlyPrice).toLocaleString("en-IN")} (${n} mo)`;
              }

              return (
                <div key={seat.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">Seat {seat.seatNumber}</span>
                        <span className="text-xs text-gray-400">{seat.section === "AC" ? "AC" : "Non-AC"}</span>
                        {isOnlineBooked && <Badge variant="secondary" className="text-xs px-1.5 py-0">Online</Badge>}
                        {seat.isOfflineBooked && (
                          <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-600 hover:bg-orange-100">Offline</Badge>
                        )}
                      </div>
                      {seat.isOfflineBooked && seat.offlineBookingName && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {seat.offlineBookingName}
                          {seat.offlineBookingFrom && seat.offlineBookingUntil
                            ? ` · ${monthLabel(seat.offlineBookingFrom)} → ${monthLabel(seat.offlineBookingUntil)}`
                            : ""}
                          {offlineAmtDisplay ? ` · ${offlineAmtDisplay}` : ""}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={seat.isOfflineBooked === true}
                      onCheckedChange={() => handleToggleOffline(seat)}
                      disabled={isOnlineBooked}
                    />
                  </div>
                  {showForm && (
                    <OfflineForm
                      seat={seat}
                      months={months}
                      onSave={(data) => handleSaveOffline(seat.id, data)}
                      onCancel={() => setExpandedOfflineId(null)}
                      pricing={pricing}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──── Management List view ────────────────────────────────────────────────────
function ManagementListView() {
  const queryClient = useQueryClient();

  const { data: allSeats = [] } = useListSeats(
    {},
    { query: { queryKey: getListSeatsQueryKey({}) } }
  );
  const { data: allBookings = [] } = useListBookings(
    {},
    { query: { queryKey: getListBookingsQueryKey({}) } }
  );
  const { data: pricing } = useGetPricing({ query: { queryKey: getGetPricingQueryKey() } });

  const adminReq = { headers: { "x-admin-token": "admin123" } } as RequestInit;
  const updateSeat = useUpdateSeat({ request: adminReq });
  const updateBooking = useUpdateBooking();

  const confirmedBookings = allBookings.filter((b) => b.status === "confirmed");

  const bookingsBySeat = new Map<number, Booking[]>();
  confirmedBookings.forEach((b) => {
    if (!bookingsBySeat.has(b.seatId)) bookingsBySeat.set(b.seatId, []);
    bookingsBySeat.get(b.seatId)!.push(b);
  });

  const handleReleaseBooking = (bookingId: number) => {
    if (!confirm("Cancel this booking?")) return;
    updateBooking.mutate(
      { id: bookingId, data: { status: "cancelled" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }) }
    );
  };

  const handleClearOffline = (seatId: number) => {
    if (!confirm("Clear offline booking for this seat?")) return;
    updateSeat.mutate(
      { id: seatId, data: { isOfflineBooked: false } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({}) });
          queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({}) });
        },
      }
    );
  };

  const sections = [
    { label: "Room 1 — AC (Seats 1–48)", seats: allSeats.filter((s) => s.room === 1) },
    { label: "Room 2 (Seats 49–93)", seats: allSeats.filter((s) => s.room === 2) },
    { label: "Common Area (Seats 94–96)", seats: allSeats.filter((s) => s.room === 3) },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <p className="text-sm text-gray-400 mb-6">
        All {allSeats.length} seats — showing all confirmed bookings.
        <span className="ml-2 text-primary font-medium">
          {confirmedBookings.length} confirmed booking{confirmedBookings.length !== 1 ? "s" : ""}.
        </span>
      </p>

      {sections.map(({ label, seats }) => (
        <div key={label} className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</h2>
          <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-50">
            {seats.map((seat) => {
              const seatBookings = bookingsBySeat.get(seat.id) ?? [];
              const isEmpty = seatBookings.length === 0 && !seat.isOfflineBooked;

              let offlineAmtDisplay = "";
              if (seat.isOfflineBooked && seat.offlineBookingFrom && seat.offlineBookingUntil && pricing) {
                const n = countMonthsInRange(seat.offlineBookingFrom, seat.offlineBookingUntil);
                const monthlyPrice = seat.isAC ? pricing.acPrice1m : pricing.nonAcPrice1m;
                offlineAmtDisplay = `₹${(n * monthlyPrice).toLocaleString("en-IN")}`;
              }

              return (
                <div key={seat.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      isEmpty
                        ? "bg-green-50 text-green-600 border border-green-200"
                        : seat.isOfflineBooked
                        ? "bg-orange-50 text-orange-600 border border-orange-200"
                        : "bg-blue-50 text-blue-600 border border-blue-200"
                    }`}>
                      {seat.seatNumber}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-800">Seat {seat.seatNumber}</span>
                        <span className="text-xs text-gray-400">{seat.section === "AC" ? "AC" : "Non-AC"}</span>
                        {isEmpty && <span className="text-xs text-green-600 font-medium">Available</span>}
                      </div>

                      {/* Online bookings */}
                      {seatBookings.map((b) => (
                        <div key={b.id} className="mt-1.5 p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-700">{b.customerName}</p>
                              <p className="text-xs text-gray-500">{b.customerPhone}</p>
                              <p className="text-xs text-blue-600 mt-0.5">
                                {b.durationMonths > 1
                                  ? `${monthLabel(b.month)} → ${monthLabel(b.endMonth)} (${b.durationMonths} mo)`
                                  : monthLabel(b.month)
                                }
                                {b.startDay && b.startDay > 1 ? ` · from ${b.startDay}th` : ""}
                              </p>
                              {b.paymentDate && (
                                <p className="text-xs text-gray-400">Paid {formatDate(b.paymentDate)}</p>
                              )}
                              {b.paymentSessionId?.startsWith("pay_") && (
                                <a
                                  href={`https://dashboard.razorpay.com/app/payments/${b.paymentSessionId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded px-1.5 py-0.5 transition-colors font-mono max-w-[140px] truncate"
                                  title={b.paymentSessionId}
                                >
                                  {b.paymentSessionId}
                                  <svg className="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>
                              <Badge variant="default" className="text-[10px] px-1 py-0 mt-0.5">Paid Online</Badge>
                              <div>
                                <button
                                  className="text-[10px] text-red-400 hover:text-red-600 mt-1 block"
                                  onClick={() => handleReleaseBooking(b.id)}
                                >
                                  Release
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Offline booking */}
                      {seat.isOfflineBooked && (
                        <div className="mt-1.5 p-2 bg-orange-50 rounded-lg border border-orange-100">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-semibold text-gray-700">
                                {seat.offlineBookingName ?? "— Name not entered —"}
                              </p>
                              {seat.offlineBookingPhone && (
                                <p className="text-xs text-gray-500">{seat.offlineBookingPhone}</p>
                              )}
                              {seat.offlineBookingFrom && seat.offlineBookingUntil && (
                                <p className="text-xs text-orange-600 mt-0.5">
                                  {monthLabel(seat.offlineBookingFrom)} → {monthLabel(seat.offlineBookingUntil)}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              {offlineAmtDisplay && (
                                <p className="text-xs font-bold text-primary mb-0.5">{offlineAmtDisplay}</p>
                              )}
                              <Badge className="text-[10px] px-1 py-0 bg-orange-100 text-orange-600 hover:bg-orange-100">Offline</Badge>
                              <button
                                className="text-[10px] text-red-400 hover:text-red-600 mt-1 block ml-auto"
                                onClick={() => handleClearOffline(seat.id)}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ──── Main Admin Dashboard shell ──────────────────────────────────────────────
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const [activeView, setActiveView] = useState<"dashboard" | "management">("dashboard");

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) navigate("/admin");
  }, []);

  const navItems = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "management" as const, label: "Management List", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <p className="font-semibold text-gray-800 text-sm">Lucky Reading Room</p>
          <p className="text-xs text-gray-400 mt-0.5">Admin Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeView === id
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {activeView === id && <ChevronRight className="w-3 h-3 ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-100">
          <button
            onClick={() => { localStorage.removeItem("adminToken"); navigate("/admin"); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-800">
            {activeView === "dashboard" ? "Dashboard" : "Management List"}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeView === "dashboard"
              ? "Monthly stats, bookings, pricing, and offline seat management"
              : "All seats with current occupants and booking details"}
          </p>
        </header>

        {activeView === "dashboard" ? <DashboardView /> : <ManagementListView />}
      </div>
    </div>
  );
}
