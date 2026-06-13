import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format, addMonths, subMonths, addDays, parseISO } from "date-fns";
import {
  useListBookings,
  useListSeats,
  useGetBookingSummary,
  useGetPricing,
  useUpdateSeat,
  useUpdatePricing,
  useUpdateBooking,
  useCreateBooking,
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

const currentMonth = () => format(new Date(), "yyyy-MM");

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return format(subMonths(new Date(y, m - 1, 1), 1), "yyyy-MM");
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return format(addMonths(new Date(y, m - 1, 1), 1), "yyyy-MM");
}

function countMonthsInRange(from: string, until: string): number {
  try {
    const f = from.length === 7 ? new Date(from + "-01") : new Date(from);
    const u = until.length === 7 ? new Date(until + "-01") : new Date(until);
    return Math.max(1, (u.getFullYear() - f.getFullYear()) * 12 + (u.getMonth() - f.getMonth()) + 1);
  } catch {
    return 1;
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    if (dateStr.length === 7) {
      const [y, m] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    }
    return parseISO(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function bookingPeriodLabel(b: Booking): string {
  if (b.startDate && b.endDate) {
    return `${formatDate(b.startDate)} → ${formatDate(b.endDate)}`;
  }
  if (b.durationMonths > 1) {
    return `${monthLabel(b.month)} → ${monthLabel(b.endMonth)} (${b.durationMonths} mo)`;
  }
  return monthLabel(b.month);
}

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

// ──── Offline booking form ─────────────────────────────────────────────────
function OfflineForm({
  seat,
  onSave,
  onCancel,
  pricing,
}: {
  seat: Seat;
  onSave: (data: { name: string; phone: string; from: string; until: string }) => void;
  onCancel: () => void;
  pricing: any;
}) {
  const [form, setForm] = useState({
    name: seat.offlineBookingName ?? "",
    phone: seat.offlineBookingPhone ?? "",
    from: seat.offlineBookingFrom ?? todayStr(),
    until: seat.offlineBookingUntil ?? format(addMonths(new Date(), 1), "yyyy-MM-dd"),
  });

  const numMonths = countMonthsInRange(form.from, form.until);
  const monthlyPrice = seat.isAC ? (pricing?.acPrice1m ?? 2000) : (pricing?.nonAcPrice1m ?? 1500);
  const totalPrice = numMonths * monthlyPrice;

  return (
    <div className="mt-2 p-3 rounded-lg bg-orange-50 border border-orange-100 space-y-2">
      <p className="text-xs font-medium text-orange-700">Offline booking for Seat {seat.seatNumber}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-gray-500">Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-sm bg-white" placeholder="Student name" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Phone</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-sm bg-white" placeholder="Phone" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="h-8 text-sm bg-white" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Until</Label>
          <Input type="date" value={form.until} min={form.from} onChange={(e) => setForm({ ...form, until: e.target.value })} className="h-8 text-sm bg-white" />
        </div>
      </div>
      <div className="bg-white rounded-lg px-3 py-2 border border-orange-100 flex items-center justify-between">
        <span className="text-xs text-gray-500">~{numMonths} mo × ₹{monthlyPrice.toLocaleString("en-IN")}/mo</span>
        <span className="text-sm font-bold text-primary">₹{totalPrice.toLocaleString("en-IN")}</span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => onSave(form)}>Save</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ──── Admin Direct Booking Form (Management List) ──────────────────────────
function AdminBookingForm({
  seat,
  onClose,
  pricing,
  onSuccess,
}: {
  seat: Seat;
  onClose: () => void;
  pricing: any;
  onSuccess: () => void;
}) {
  const adminReq = { headers: { "x-admin-token": "admin123" } } as RequestInit;
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking({ request: adminReq });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    startDate: todayStr(),
    endDate: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const monthlyRate = seat.isAC ? (pricing?.acPrice1m ?? 2000) : (pricing?.nonAcPrice1m ?? 1500);
  const days = form.startDate && form.endDate && form.endDate >= form.startDate
    ? Math.max(1, Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1)
    : 0;
  const total = days > 0 ? Math.round((monthlyRate / 30) * days) : 0;

  const handleSave = async () => {
    setError("");
    if (!form.name || !form.phone) { setError("Name and phone are required."); return; }
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) { setError("Invalid date range."); return; }
    setSaving(true);
    createBooking.mutate(
      { data: { seatId: seat.id, customerName: form.name, customerPhone: form.phone, customerEmail: form.email || undefined, startDate: form.startDate, endDate: form.endDate } },
      {
        onSuccess: (booking) => {
          updateBooking.mutate(
            { id: booking.id, data: { status: "confirmed" } },
            {
              onSuccess: () => { setSaving(false); onSuccess(); onClose(); },
              onError: () => { setSaving(false); setError("Created but could not auto-confirm. Please confirm manually."); onSuccess(); },
            }
          );
        },
        onError: (err: any) => { setSaving(false); setError(err?.data?.error ?? "Failed to create booking."); },
      }
    );
  };

  return (
    <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-100 space-y-2">
      <p className="text-xs font-semibold text-blue-700">Direct Booking — Seat {seat.seatNumber} (admin)</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs text-gray-500">Name *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-8 text-sm bg-white" placeholder="Student name" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Phone *</Label>
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-sm bg-white" placeholder="Phone" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Email</Label>
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-sm bg-white" placeholder="Optional" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Start Date *</Label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="h-8 text-sm bg-white" />
        </div>
        <div>
          <Label className="text-xs text-gray-500">End Date *</Label>
          <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="h-8 text-sm bg-white" />
        </div>
      </div>
      {days > 0 && (
        <div className="bg-white rounded-lg px-3 py-2 border border-blue-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">{days} day{days !== 1 ? "s" : ""} × ₹{Math.round(monthlyRate / 30)}/day</span>
          <span className="text-sm font-bold text-primary">₹{total.toLocaleString("en-IN")}</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Create & Confirm"}
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ──── Dashboard view ──────────────────────────────────────────────────────────
function DashboardView() {
  const queryClient = useQueryClient();
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
  const updateBooking = useUpdateBooking({ request: adminReq });

  const invalidateSeats = () => queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({ month }) });
  const invalidateBookings = () => {
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({ month }) });
    queryClient.invalidateQueries({ queryKey: getGetBookingSummaryQueryKey({ month }) });
  };

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
        data: { isOfflineBooked: true, offlineBookingName: data.name || null, offlineBookingPhone: data.phone || null, offlineBookingFrom: data.from || null, offlineBookingUntil: data.until || null },
      },
      { onSuccess: () => { setExpandedOfflineId(null); invalidateSeats(); invalidateBookings(); } }
    );
  };

  const handleToggleOffline = (seat: Seat) => {
    if (!seat.isOfflineBooked) {
      setExpandedOfflineId(seat.id);
    } else {
      updateSeat.mutate(
        { id: seat.id, data: { isOfflineBooked: false } },
        { onSuccess: () => { invalidateSeats(); invalidateBookings(); } }
      );
    }
  };

  const handleToggleRoom2 = (makeAc: boolean) => {
    updatePricing.mutate(
      { data: { room2IsAc: makeAc } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetPricingQueryKey() }); invalidateSeats(); } }
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

  const handleConfirmBooking = (bookingId: number) => {
    if (!confirm("Confirm this booking? This marks payment as received.")) return;
    updateBooking.mutate(
      { id: bookingId, data: { status: "confirmed" } },
      { onSuccess: () => { invalidateBookings(); invalidateSeats(); } }
    );
  };

  const handleRejectBooking = (bookingId: number) => {
    if (!confirm("Reject this booking? The seat will remain available.")) return;
    updateBooking.mutate(
      { id: bookingId, data: { status: "cancelled" } },
      { onSuccess: () => { invalidateBookings(); invalidateSeats(); } }
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
      {/* Month nav */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
          <button onClick={() => setMonth(prevMonth(month))} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-700 min-w-[120px] text-center">{monthLabel(month)}</span>
          <button onClick={() => setMonth(nextMonth(month))} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>

        <button onClick={() => setMonth(currentMonth())} className="text-xs text-primary hover:underline">Today</button>

        {pricing && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 font-medium">Room 2:</span>
            <Select value={pricing.room2IsAc ? "ac" : "nonac"} onValueChange={(v) => handleToggleRoom2(v === "ac")}>
              <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent p-0 focus:ring-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nonac">Non-AC</SelectItem>
                <SelectItem value="ac">AC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => setPricingOpen(!pricingOpen)}>Edit Pricing</Button>
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
                      <Input type="number" placeholder={String(cur)} value={pricingEdit[key]} onChange={(e) => setPricingEdit({ ...pricingEdit, [key]: e.target.value })} className="bg-gray-50 h-8 text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleUpdatePricing} disabled={updatePricing.isPending}>{updatePricing.isPending ? "Saving…" : "Save Changes"}</Button>
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
            <h2 className="font-semibold text-gray-700 text-sm mb-3">{monthLabel(month)} — Bookings</h2>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["confirmed", "pending"] as const).map((tab) => {
                const count = tab === "confirmed" ? confirmedBookings.length : pendingBookings.length;
                return (
                  <button
                    key={tab}
                    onClick={() => setBookingTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${bookingTab === tab ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {tab === "confirmed" ? "Confirmed" : "Pending"}
                    <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${tab === "confirmed" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
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
              {bookingTab === "confirmed" ? "No confirmed bookings for this month." : "No pending bookings."}
            </div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[450px] overflow-y-auto">
              {displayedBookings.map((b) => (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-sm font-bold text-gray-800">Seat {b.seatNumber}</span>
                        <span className="text-xs text-gray-400">{b.section === "AC" ? "AC" : "Non-AC"}</span>
                        <Badge
                          variant={b.status === "confirmed" ? "default" : "secondary"}
                          className={`text-xs px-1.5 py-0 ${b.status === "pending" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" : ""}`}
                        >
                          {b.status === "confirmed" ? "Confirmed ✓" : "Pending"}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 font-medium">{b.customerName}</p>
                      <p className="text-xs text-gray-400">{b.customerPhone}{b.customerEmail ? ` · ${b.customerEmail}` : ""}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{bookingPeriodLabel(b)}</p>
                      {b.paymentDate && <p className="text-xs text-green-600 mt-0.5">Confirmed: {formatDate(b.paymentDate)}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>
                      {b.status === "pending" && (
                        <div className="flex flex-col gap-1 mt-1">
                          <button className="text-xs text-green-600 hover:text-green-800 transition-colors font-semibold" onClick={() => handleConfirmBooking(b.id)}>✓ Confirm</button>
                          <button className="text-xs text-red-400 hover:text-red-600 transition-colors" onClick={() => handleRejectBooking(b.id)}>✗ Reject</button>
                        </div>
                      )}
                      {b.status === "confirmed" && (
                        <button className="text-xs text-red-400 hover:text-red-600 mt-1 transition-colors" onClick={() => handleCancelBooking(b.id)}>Release</button>
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
            <p className="text-xs text-gray-400 mt-0.5">Toggle seats booked directly at the desk</p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
            {seats.map((seat) => {
              const isOnlineBooked = seat.bookedForMonth === true && !seat.isOfflineBooked;
              const showForm = expandedOfflineId === seat.id;

              let offlineAmtDisplay = "";
              if (seat.isOfflineBooked && seat.offlineBookingFrom && seat.offlineBookingUntil && pricing) {
                const n = countMonthsInRange(seat.offlineBookingFrom, seat.offlineBookingUntil);
                offlineAmtDisplay = `₹${(n * (seat.isAC ? pricing.acPrice1m : pricing.nonAcPrice1m)).toLocaleString("en-IN")} (${n} mo)`;
              }

              return (
                <div key={seat.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-800">Seat {seat.seatNumber}</span>
                        <span className="text-xs text-gray-400">{seat.section === "AC" ? "AC" : "Non-AC"}</span>
                        {isOnlineBooked && <Badge variant="secondary" className="text-xs px-1.5 py-0">Online</Badge>}
                        {seat.isOfflineBooked && <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-600 hover:bg-orange-100">Offline</Badge>}
                      </div>
                      {seat.isOfflineBooked && seat.offlineBookingName && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {seat.offlineBookingName}
                          {seat.offlineBookingFrom && seat.offlineBookingUntil ? ` · ${formatDate(seat.offlineBookingFrom)} → ${formatDate(seat.offlineBookingUntil)}` : ""}
                          {offlineAmtDisplay ? ` · ${offlineAmtDisplay}` : ""}
                        </p>
                      )}
                    </div>
                    <Switch checked={seat.isOfflineBooked === true} onCheckedChange={() => handleToggleOffline(seat)} disabled={isOnlineBooked} />
                  </div>
                  {showForm && (
                    <OfflineForm seat={seat} onSave={(data) => handleSaveOffline(seat.id, data)} onCancel={() => setExpandedOfflineId(null)} pricing={pricing} />
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

// ──── Management List view ─────────────────────────────────────────────────
function ManagementListView() {
  const queryClient = useQueryClient();
  const [activeRoom, setActiveRoom] = useState<1 | 2 | 3>(1);
  const [vacanciesOpen, setVacanciesOpen] = useState(true);
  const [adminBookingForSeatId, setAdminBookingForSeatId] = useState<number | null>(null);

  const { data: allSeats = [] } = useListSeats({}, { query: { queryKey: getListSeatsQueryKey({}) } });
  const { data: allBookings = [] } = useListBookings({}, { query: { queryKey: getListBookingsQueryKey({}) } });
  const { data: pricing } = useGetPricing({ query: { queryKey: getGetPricingQueryKey() } });

  const adminReq = { headers: { "x-admin-token": "admin123" } } as RequestInit;
  const updateSeat = useUpdateSeat({ request: adminReq });
  const updateBooking = useUpdateBooking({ request: adminReq });

  const confirmedBookings = allBookings.filter((b) => b.status === "confirmed");
  const pendingBookings = allBookings.filter((b) => b.status === "pending");

  const bookingsBySeat = new Map<number, Booking[]>();
  confirmedBookings.forEach((b) => {
    if (!bookingsBySeat.has(b.seatId)) bookingsBySeat.set(b.seatId, []);
    bookingsBySeat.get(b.seatId)!.push(b);
  });

  const pendingBySeat = new Map<number, Booking[]>();
  pendingBookings.forEach((b) => {
    if (!pendingBySeat.has(b.seatId)) pendingBySeat.set(b.seatId, []);
    pendingBySeat.get(b.seatId)!.push(b);
  });

  const handleReleaseBooking = (bookingId: number) => {
    if (!confirm("Cancel this booking?")) return;
    updateBooking.mutate(
      { id: bookingId, data: { status: "cancelled" } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({}) }) }
    );
  };

  const handleConfirmPending = (bookingId: number) => {
    if (!confirm("Confirm this pending booking?")) return;
    updateBooking.mutate(
      { id: bookingId, data: { status: "confirmed" } },
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

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey({}) });
    queryClient.invalidateQueries({ queryKey: getListSeatsQueryKey({}) });
  };

  const ROOM_TABS = [
    { room: 1 as const, label: "Room 1 (AC)", sublabel: "Seats 1–48", seats: allSeats.filter((s) => s.room === 1) },
    { room: 2 as const, label: "Room 2",      sublabel: "Seats 49–93", seats: allSeats.filter((s) => s.room === 2) },
    { room: 3 as const, label: "Common Area", sublabel: "Seats 94–96", seats: allSeats.filter((s) => s.room === 3) },
  ];

  const activeTab = ROOM_TABS.find((t) => t.room === activeRoom)!;
  const activeSeats = activeTab.seats;

  const now = new Date();
  const soon = addDays(now, 30);

  type VacancyItem = { seat: typeof activeSeats[0]; endDateStr: string; endDate: Date; holderName: string; type: "online" | "offline" };
  const upcomingVacancies: VacancyItem[] = [];
  activeSeats.forEach((seat) => {
    (bookingsBySeat.get(seat.id) ?? []).forEach((b) => {
      const endDateStr = b.endDate ?? b.endMonth;
      const endDate = b.endDate ? new Date(b.endDate) : (() => { const [y, m] = b.endMonth.split("-").map(Number); return new Date(y, m, 0); })();
      if (endDate >= now && endDate <= soon) upcomingVacancies.push({ seat, endDateStr, endDate, holderName: b.customerName, type: "online" });
    });
    if (seat.isOfflineBooked && seat.offlineBookingUntil) {
      const endDate = new Date(seat.offlineBookingUntil);
      if (endDate >= now && endDate <= soon) upcomingVacancies.push({ seat, endDateStr: seat.offlineBookingUntil, endDate, holderName: seat.offlineBookingName ?? "—", type: "offline" });
    }
  });
  upcomingVacancies.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  const renderSeatCard = (seat: typeof activeSeats[0]) => {
    const seatBookings = bookingsBySeat.get(seat.id) ?? [];
    const seatPending = pendingBySeat.get(seat.id) ?? [];
    const isEmpty = seatBookings.length === 0 && !seat.isOfflineBooked;
    const showAdminForm = adminBookingForSeatId === seat.id;

    let offlineAmtDisplay = "";
    if (seat.isOfflineBooked && seat.offlineBookingFrom && seat.offlineBookingUntil && pricing) {
      const n = countMonthsInRange(seat.offlineBookingFrom, seat.offlineBookingUntil);
      offlineAmtDisplay = `₹${(n * (seat.isAC ? pricing.acPrice1m : pricing.nonAcPrice1m)).toLocaleString("en-IN")}`;
    }

    return (
      <div key={seat.id} className="px-5 py-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
            isEmpty ? "bg-green-50 text-green-600 border border-green-200"
            : seat.isOfflineBooked ? "bg-orange-50 text-orange-600 border border-orange-200"
            : "bg-blue-50 text-blue-600 border border-blue-200"
          }`}>
            {seat.seatNumber}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">Seat {seat.seatNumber}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">{seat.section === "AC" ? "AC" : "Non-AC"}</span>
                {isEmpty && !seatPending.length && <span className="text-xs text-green-600 font-medium">Available</span>}
              </div>
              {isEmpty && !seat.isOfflineBooked && !showAdminForm && (
                <button
                  onClick={() => setAdminBookingForSeatId(seat.id)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                >
                  + Book
                </button>
              )}
            </div>

            {/* Admin booking form */}
            {showAdminForm && (
              <AdminBookingForm
                seat={seat}
                onClose={() => setAdminBookingForSeatId(null)}
                pricing={pricing}
                onSuccess={invalidateAll}
              />
            )}

            {/* Pending bookings for this seat */}
            {seatPending.map((b) => (
              <div key={b.id} className="mt-1.5 p-2.5 bg-yellow-50 rounded-lg border border-yellow-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-gray-700">{b.customerName}</p>
                      <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400 text-white hover:bg-yellow-400">Pending</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{b.customerPhone}</p>
                    <p className="text-xs text-yellow-700 mt-0.5">{bookingPeriodLabel(b)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>
                    <button className="text-[10px] text-green-600 hover:text-green-800 block mt-1 ml-auto font-semibold" onClick={() => handleConfirmPending(b.id)}>✓ Confirm</button>
                    <button className="text-[10px] text-red-400 hover:text-red-600 block ml-auto" onClick={() => handleReleaseBooking(b.id)}>✗ Reject</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Confirmed bookings */}
            {seatBookings.map((b) => (
              <div key={b.id} className="mt-1.5 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-gray-700">{b.customerName}</p>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-blue-600">Online</Badge>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">Confirmed</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{b.customerPhone}</p>
                    <p className="text-xs text-blue-600 mt-0.5">{bookingPeriodLabel(b)}</p>
                    {b.paymentDate && <p className="text-xs text-gray-400">Confirmed {formatDate(b.paymentDate)}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-primary">₹{Number(b.amount).toLocaleString("en-IN")}</p>
                    <button className="text-[10px] text-red-400 hover:text-red-600 mt-1 block ml-auto" onClick={() => handleReleaseBooking(b.id)}>Release</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Offline booking */}
            {seat.isOfflineBooked && (
              <div className="mt-1.5 p-2.5 bg-orange-50 rounded-lg border border-orange-100">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-semibold text-gray-700">{seat.offlineBookingName ?? "— Name not entered —"}</p>
                      <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 hover:bg-orange-500">Offline</Badge>
                    </div>
                    {seat.offlineBookingPhone && <p className="text-xs text-gray-500 mt-0.5">{seat.offlineBookingPhone}</p>}
                    {seat.offlineBookingFrom && seat.offlineBookingUntil && (
                      <p className="text-xs text-orange-600 mt-0.5">{formatDate(seat.offlineBookingFrom)} → {formatDate(seat.offlineBookingUntil)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {offlineAmtDisplay && <p className="text-xs font-bold text-primary mb-1">{offlineAmtDisplay}</p>}
                    <button className="text-[10px] text-red-400 hover:text-red-600 block ml-auto" onClick={() => handleClearOffline(seat.id)}>Clear</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Room tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {ROOM_TABS.map((tab) => {
          const occupied = tab.seats.filter((s) => s.isOfflineBooked || (bookingsBySeat.get(s.id) ?? []).length > 0).length;
          const pending = tab.seats.reduce((sum, s) => sum + (pendingBySeat.get(s.id) ?? []).length, 0);
          return (
            <button
              key={tab.room}
              onClick={() => setActiveRoom(tab.room)}
              className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeRoom === tab.room ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <span className="font-semibold">{tab.label}</span>
              <span className={`text-[10px] mt-0.5 ${activeRoom === tab.room ? "text-primary" : "text-gray-400"}`}>
                {tab.sublabel} · {occupied}/{tab.seats.length}{pending > 0 ? ` · ${pending} pending` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {/* Upcoming Vacancies */}
      {upcomingVacancies.length > 0 && (
        <div className="mb-5 border border-amber-200 rounded-xl bg-amber-50 overflow-hidden">
          <button onClick={() => setVacanciesOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold text-amber-800">Upcoming Vacancies (Next 30 Days)</span>
              <span className="bg-amber-200 text-amber-800 text-[10px] font-bold rounded-full px-2 py-0.5">{upcomingVacancies.length}</span>
            </div>
            <svg className={`w-4 h-4 text-amber-500 transition-transform ${vacanciesOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {vacanciesOpen && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              {upcomingVacancies.map((v, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md bg-amber-100 border border-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-700">{v.seat.seatNumber}</div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{v.holderName}</p>
                      <p className="text-[10px] text-gray-500">Seat {v.seat.seatNumber} · {v.seat.section}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge className={`text-[10px] px-1.5 py-0 ${v.type === "online" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-orange-100 text-orange-700 hover:bg-orange-100"}`}>
                      {v.type === "online" ? "Online" : "Offline"}
                    </Badge>
                    <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Ends {formatDate(v.endDateStr)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-50">
        {activeSeats.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 text-center">No seats in this room.</p>
        ) : activeSeats.map(renderSeatCard)}
      </div>
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeView === id ? "bg-primary/10 text-primary font-semibold" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-4">
          <h1 className="text-lg font-semibold text-gray-800">{activeView === "dashboard" ? "Dashboard" : "Management List"}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeView === "dashboard" ? "Monthly stats, bookings, pricing & offline seat management" : "All seats with current occupants — confirm, reject, or add direct bookings"}
          </p>
        </header>
        {activeView === "dashboard" ? <DashboardView /> : <ManagementListView />}
      </div>
    </div>
  );
}
