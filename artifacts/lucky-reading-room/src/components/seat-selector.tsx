import { useState } from "react";
import { format, addMonths, differenceInCalendarDays, parseISO } from "date-fns";
import { Seat } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function daysBetween(start: string, end: string): number {
  try {
    return Math.max(1, differenceInCalendarDays(parseISO(end), parseISO(start)) + 1);
  } catch {
    return 1;
  }
}

function formatDisplayDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Floor plan layout — matching the physical room layout
const AC_ROW1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const AC_ROWS_SPLIT = [
  { left: [24, 23, 22, 21, 20, 19], right: [18, 17, 16, 15, 14, 13] },
  { left: [25, 26, 27, 28, 29, 30], right: [31, 32, 33, 34, 35, 36] },
  { left: [48, 47, 46, 45, 44, 43], right: [42, 41, 40, 39, 38, 37] },
];

const NAC_ROWS = [
  { left: [49, 50, 51, 52, 53],       right: [54, 55, 56, 57, 58]       },
  { left: [70, 69, 68, 67, 66, 65],   right: [64, 63, 62, 61, 60, 59]   },
  { left: [71, 72, 73, 74, 75, 76],   right: [77, 78, 79, 80, 81, 82]   },
  { left: [93, 92, 91, 90, 89, 88],   right: [87, 86, 85, 84, 83]       },
];

const COMMON = [94, 95, 96];

export function SeatSelector({
  seats = [],
  startDate,
  endDate,
  onDateChange,
  isLoading,
}: {
  seats: Seat[];
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
  isLoading: boolean;
}) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  const room2IsAc = seats.some((s) => s.room === 2 && s.isAC);

  const getSeatData = (n: number) => seats.find((s) => s.seatNumber === n);

  const getStatus = (n: number) => {
    const s = getSeatData(n);
    if (!s) return "unavailable";
    if (s.isOfflineBooked || s.bookedForMonth) return "booked";
    return "available";
  };

  const getTooltip = (n: number): string => {
    const s = getSeatData(n);
    if (!s) return `Seat ${n}`;
    if (s.isOfflineBooked) return `Seat ${n} — Occupied (offline)`;
    if (s.bookedForMonth && s.bookedByName) return `Seat ${n} — ${s.bookedByName}`;
    if (s.bookedForMonth) return `Seat ${n} — Occupied`;
    const days = daysBetween(startDate, endDate);
    const rate = s.price ?? (s.isAC ? 2000 : 1500);
    const total = Math.round((rate / 30) * days);
    return `Seat ${n} — ₹${total.toLocaleString("en-IN")} for ${days} day${days !== 1 ? "s" : ""}`;
  };

  const handleClick = (n: number) => {
    const s = getSeatData(n);
    if (!s || getStatus(n) !== "available") return;
    setSelectedSeat(selectedSeat?.seatNumber === n ? null : s);
  };

  const renderSeat = (n: number) => {
    const status = getStatus(n);
    const isSelected = selectedSeat?.seatNumber === n;

    let cls = "w-9 h-9 rounded-t-lg rounded-b-sm border-2 text-[11px] font-semibold flex items-center justify-center transition-all select-none ";
    if (status === "unavailable") {
      cls += "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-40";
    } else if (status === "booked") {
      cls += "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed";
    } else if (isSelected) {
      cls += "bg-primary border-primary text-primary-foreground shadow-md scale-105 cursor-pointer";
    } else {
      cls += "bg-white border-green-400 text-green-700 hover:bg-green-50 hover:scale-105 cursor-pointer shadow-sm";
    }

    return (
      <button
        key={n}
        disabled={status !== "available"}
        className={cls}
        onClick={() => handleClick(n)}
        title={getTooltip(n)}
      >
        {n}
      </button>
    );
  };

  const Aisle = () => (
    <div className="w-8 flex items-center justify-center shrink-0">
      <span className="text-[9px] text-gray-300 tracking-[0.15em] uppercase" style={{ writingMode: "vertical-rl" }}>aisle</span>
    </div>
  );

  const room1Price = seats.find((s) => s.room === 1)?.price;
  const room2Price = seats.find((s) => s.room === 2)?.price;
  const room2Label = room2IsAc ? "ROOM 2 — AC" : "ROOM 2 — NON-AC";

  const days = startDate && endDate && endDate >= startDate ? daysBetween(startDate, endDate) : 0;

  const selectedTotal = selectedSeat && days > 0
    ? Math.round(((selectedSeat.price ?? (selectedSeat.isAC ? 2000 : 1500)) / 30) * days)
    : 0;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 py-6">
      {/* Header + date-range pickers */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4 px-2">
        <div>
          <h2 className="text-2xl font-serif text-foreground font-semibold">Select Your Cabin</h2>
          {days > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)} · {days} day{days !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">From</Label>
            <Input
              type="date"
              value={startDate}
              min={todayStr()}
              onChange={(e) => {
                const newStart = e.target.value;
                const newEnd = endDate < newStart ? newStart : endDate;
                setSelectedSeat(null);
                onDateChange(newStart, newEnd);
              }}
              className="h-9 w-38 text-sm bg-white border-gray-200 shadow-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Until</Label>
            <Input
              type="date"
              value={endDate}
              min={startDate || todayStr()}
              onChange={(e) => {
                setSelectedSeat(null);
                onDateChange(startDate, e.target.value);
              }}
              className="h-9 w-38 text-sm bg-white border-gray-200 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-xs text-gray-500 flex-wrap justify-center">
        {[
          { color: "bg-white border-green-400", label: "Vacant" },
          { color: "bg-primary border-primary", label: "Selected" },
          { color: "bg-gray-200 border-gray-300", label: "Occupied" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 ${color} border-2 rounded-sm shadow-sm`}></div>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className={`w-full overflow-x-auto pb-4 ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="min-w-[600px] flex flex-col items-center gap-5 px-2">

          {/* ROOM 1 — AC */}
          <div className="w-full border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Room 1 — AC</h3>
              <span className="text-xs text-green-600 font-medium">
                {room1Price != null ? `₹${room1Price.toLocaleString("en-IN")}/mo` : "₹2,000/mo"}
              </span>
            </div>
            <div className="flex justify-center mb-4">
              <div className="flex gap-1.5">{AC_ROW1.map(renderSeat)}</div>
            </div>
            <div className="flex flex-col gap-3">
              {AC_ROWS_SPLIT.map((row, i) => (
                <div key={i} className="flex items-center justify-center">
                  <div className="flex gap-1.5">{row.left.map(renderSeat)}</div>
                  <Aisle />
                  <div className="flex gap-1.5">{row.right.map(renderSeat)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ROOM 2 */}
          <div className="w-full border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">{room2Label}</h3>
              <span className="text-xs text-green-600 font-medium">
                {room2Price != null ? `₹${room2Price.toLocaleString("en-IN")}/mo` : (room2IsAc ? "₹2,000/mo" : "₹1,500/mo")}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {NAC_ROWS.map((row, i) => (
                <div key={i} className="flex items-center justify-center">
                  <div className="flex gap-1.5">{row.left.map(renderSeat)}</div>
                  <Aisle />
                  <div className="flex gap-1.5">{row.right.map(renderSeat)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ROOM 3 — Common Area */}
          <div className="flex justify-end w-full">
            <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
              <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3 text-center">Common Area</h3>
              <div className="flex gap-1.5 justify-center">{COMMON.map(renderSeat)}</div>
            </div>
          </div>

        </div>
      </div>

      {/* Selected seat bottom bar */}
      {selectedSeat && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40 animate-in slide-in-from-bottom-full">
          <div className="container max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Selected Cabin</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-primary">#{selectedSeat.seatNumber}</p>
                <p className="text-sm text-gray-500">{selectedSeat.section === "AC" ? "AC" : "Non-AC"}</p>
              </div>
              {days > 0 && (
                <p className="text-xs text-gray-400">
                  {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)} · {days} day{days !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {selectedTotal > 0 && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-xl font-bold text-gray-800">₹{selectedTotal.toLocaleString("en-IN")}</p>
                </div>
              )}
              <Link href={`/book/${selectedSeat.id}?startDate=${startDate}&endDate=${endDate}`}>
                <Button size="lg" className="font-semibold px-8" disabled={days <= 0}>
                  Book This Cabin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
