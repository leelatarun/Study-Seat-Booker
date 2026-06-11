import { useState } from "react";
import { format, addMonths } from "date-fns";
import { Seat } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const getMonths = () => {
  const baseDate = new Date(2026, 6, 1);
  return Array.from({ length: 6 }).map((_, i) => {
    const date = addMonths(baseDate, i);
    return { value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy") };
  });
};

// Floor plan layout matching the physical room
// Room 1 (AC, seats 1–48)
const AC_ROWS = [
  { left: [1,2,3,4,5,6], right: [7,8,9,10,11,12] },
  { left: [24,23,22,21,20,19], right: [18,17,16,15,14,13] },
  { left: [25,26,27,28,29,30], right: [31,32,33,34,35,36] },
  { left: [48,47,46,45,44,43], right: [42,41,40,39,38,37] },
];
// Row 1 is full-width (no aisle split in middle)
const AC_ROW1 = [1,2,3,4,5,6,7,8,9,10,11,12];

// Room 2 (Non-AC / switchable, seats 49–93)
const NAC_ROWS = [
  { left: [49,50,51,52,53], right: [54,55,56,57,58] },
  { left: [70,69,68,67,66,65], right: [64,63,62,61,60,59] },
  { left: [71,72,73,74,75,76], right: [77,78,79,80,81,82] },
  { left: [93,92,91,90,89], right: [88,87,86,85,84,83] },
];

// Room 3 Common Area
const COMMON = [94, 95, 96];

export function SeatSelector({
  seats = [],
  month,
  onMonthChange,
  isLoading,
}: {
  seats: Seat[];
  month: string;
  onMonthChange: (m: string) => void;
  isLoading: boolean;
}) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const months = getMonths();

  // Derive Room 2 status from seats data
  const room2IsAc = seats.some((s) => s.room === 2 && s.isAC);

  const getSeatData = (seatNumber: number) => seats.find((s) => s.seatNumber === seatNumber);

  const getStatus = (seatNumber: number) => {
    const s = getSeatData(seatNumber);
    if (!s) return "unavailable";
    if (s.isOfflineBooked) return "offline";
    if (s.bookedForMonth) return "booked";
    return "available";
  };

  const handleClick = (seatNumber: number) => {
    const s = getSeatData(seatNumber);
    if (!s) return;
    const status = getStatus(seatNumber);
    if (status !== "available") return;
    setSelectedSeat(selectedSeat?.seatNumber === seatNumber ? null : s);
  };

  const renderSeat = (seatNumber: number) => {
    const status = getStatus(seatNumber);
    const isSelected = selectedSeat?.seatNumber === seatNumber;

    let cls =
      "w-9 h-9 rounded-t-lg rounded-b-sm border-2 text-[11px] font-semibold flex items-center justify-center transition-all select-none ";
    if (status === "unavailable") {
      cls += "bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-50";
    } else if (status === "offline" || status === "booked") {
      cls += "bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed";
    } else if (isSelected) {
      cls += "bg-primary border-primary text-primary-foreground shadow-md scale-105 cursor-pointer";
    } else {
      cls += "bg-white border-green-500 text-green-700 hover:bg-green-50 hover:scale-105 cursor-pointer shadow-sm";
    }

    return (
      <button
        key={seatNumber}
        disabled={status !== "available"}
        className={cls}
        onClick={() => handleClick(seatNumber)}
        title={`Seat ${seatNumber}`}
      >
        {seatNumber}
      </button>
    );
  };

  const Aisle = ({ vertical = false }) => (
    <div className={`${vertical ? "h-full w-8" : "w-8 h-full"} flex items-center justify-center`}>
      <span className="text-[9px] text-gray-300 rotate-90 tracking-[0.2em] uppercase">aisle</span>
    </div>
  );

  const room2Label = room2IsAc ? "ROOM 2 — AC" : "ROOM 2 — NON-AC";
  const room2Pricing = room2IsAc ? "AC rates apply" : "Non-AC rates apply";

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 py-6">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 px-2">
        <h2 className="text-2xl font-serif text-foreground font-semibold">Select Your Cabin</h2>
        <div className="w-52">
          <Select value={month} onValueChange={onMonthChange}>
            <SelectTrigger className="w-full bg-white border-gray-200 shadow-sm">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-xs text-gray-500 flex-wrap justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-white border-2 border-green-500 rounded-sm shadow-sm"></div>
          <span>Vacant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-primary border-2 border-primary rounded-sm shadow-sm"></div>
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-gray-200 border-2 border-gray-300 rounded-sm"></div>
          <span>Occupied</span>
        </div>
      </div>

      <div className={`w-full overflow-x-auto pb-4 ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="min-w-[600px] flex flex-col items-center gap-5 px-2">

          {/* ROOM 1 — AC */}
          <div className="w-full border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Room 1 — AC</h3>
              <span className="text-xs text-green-600 font-medium">₹2,000/mo</span>
            </div>

            {/* Row 1 – full width 12 seats */}
            <div className="flex justify-center mb-4">
              <div className="flex gap-1.5">
                {AC_ROW1.map(renderSeat)}
              </div>
            </div>

            {/* Rows 2-4 – split with aisle */}
            <div className="flex flex-col gap-3">
              {AC_ROWS.slice(1).map((row, i) => (
                <div key={`ac-row-${i}`} className="flex items-center justify-center">
                  <div className="flex gap-1.5">{row.left.map(renderSeat)}</div>
                  <Aisle />
                  <div className="flex gap-1.5">{row.right.map(renderSeat)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ROOM 2 — Non-AC (or AC if toggled) */}
          <div className="w-full border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase">{room2Label}</h3>
              <span className="text-xs text-gray-400 font-medium">{room2Pricing}</span>
            </div>

            <div className="flex flex-col gap-3">
              {NAC_ROWS.map((row, i) => (
                <div key={`nac-row-${i}`} className="flex items-center justify-center">
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
              <h3 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3 text-center">
                Common Area
              </h3>
              <div className="flex gap-1.5 justify-center">
                {COMMON.map(renderSeat)}
              </div>
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
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500">From</p>
                <p className="text-xl font-bold text-gray-800">₹{selectedSeat.price?.toLocaleString("en-IN")}/mo</p>
              </div>
              <Link href={`/book/${selectedSeat.id}?month=${month}`}>
                <Button size="lg" className="font-semibold px-8">
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
