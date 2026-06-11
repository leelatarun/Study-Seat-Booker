import { useState } from "react";
import { format, addMonths } from "date-fns";
import { Seat } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

// Generate next 6 months starting from July 2026
const getMonths = () => {
  const baseDate = new Date(2026, 6, 1); // July 2026
  return Array.from({ length: 6 }).map((_, i) => {
    const date = addMonths(baseDate, i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });
};

const ROWS = {
  ac: [
    [1,2,3,4,5,6, 7,8,9,10,11,12],
    [24,23,22,21,20,19, 18,17,16,15,14,13],
    [25,26,27,28,29,30, 31,32,33,34,35,36],
    [48,47,46,45,44,43, 42,41,40,39,38,37],
    [49,50,51,52,53,54, 55,56,57,58,59,60]
  ],
  nonAc: [
    [72,71,70,69,68,67, 66,65,64,63,62,61],
    [73,74,75,76,77,78, 79,80,81,82,83,84],
    [96,95,94,93,92,91, 90,89,88,87,86,85],
    [97,98,99]
  ]
};

export function SeatSelector({ 
  seats = [], 
  month, 
  onMonthChange,
  isLoading 
}: { 
  seats: Seat[];
  month: string;
  onMonthChange: (m: string) => void;
  isLoading: boolean;
}) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const months = getMonths();

  const getSeatStatus = (seatNumber: number) => {
    const seat = seats.find(s => s.seatNumber === seatNumber);
    if (!seat) return 'unavailable';
    if (seat.isUnderMaintenance) return 'maintenance';
    if (seat.bookedForMonth) return 'booked';
    return 'available';
  };

  const handleSeatClick = (seatNumber: number) => {
    const seat = seats.find(s => s.seatNumber === seatNumber);
    if (seat && !seat.bookedForMonth && !seat.isUnderMaintenance) {
      setSelectedSeat(seat.id === selectedSeat?.id ? null : seat);
    }
  };

  const renderSeat = (seatNumber: number) => {
    const status = getSeatStatus(seatNumber);
    const seat = seats.find(s => s.seatNumber === seatNumber);
    const isSelected = selectedSeat?.seatNumber === seatNumber;
    
    let buttonClass = "w-8 h-8 rounded-t-lg rounded-b-sm border-2 text-xs font-semibold flex items-center justify-center transition-all ";
    
    if (status === 'unavailable') {
      buttonClass += "bg-muted border-muted-foreground/20 text-muted-foreground/50 opacity-50 cursor-not-allowed";
    } else if (status === 'maintenance') {
      buttonClass += "bg-muted border-muted-foreground/40 text-muted-foreground line-through cursor-not-allowed bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.1)_4px,rgba(0,0,0,0.1)_8px)]";
    } else if (status === 'booked') {
      buttonClass += "bg-muted border-muted-foreground text-muted-foreground cursor-not-allowed";
    } else if (isSelected) {
      buttonClass += "bg-primary border-primary text-primary-foreground shadow-[0_0_10px_rgba(251,191,36,0.5)]";
    } else {
      buttonClass += "bg-background border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/20 cursor-pointer";
    }

    return (
      <button
        key={seatNumber}
        disabled={status !== 'available'}
        className={buttonClass}
        onClick={() => handleSeatClick(seatNumber)}
        data-testid={`seat-${seatNumber}`}
      >
        {seatNumber}
      </button>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-8 py-8">
      <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 px-4">
        <h2 className="text-2xl font-serif text-primary">Select Your Seat</h2>
        <div className="w-48">
          <Select value={month} onValueChange={onMonthChange}>
            <SelectTrigger className="w-full bg-card border-border">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-6 text-sm text-muted-foreground px-4 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#22c55e] rounded-sm"></div> Available
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary border-2 border-primary rounded-sm shadow-[0_0_5px_rgba(251,191,36,0.5)]"></div> Selected
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted border-2 border-muted-foreground rounded-sm"></div> Booked
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-muted border-2 border-muted-foreground/40 rounded-sm bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]"></div> Maintenance
        </div>
      </div>

      <div className={`w-full overflow-x-auto pb-8 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="min-w-[600px] flex flex-col items-center gap-8">
          
          <div className="w-full flex flex-col items-center border border-border/50 rounded-xl p-6 bg-card/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-6">AC SECTION - ₹2,000/mo</h3>
            <div className="flex flex-col gap-4">
              {ROWS.ac.map((row, i) => (
                <div key={`ac-row-${i}`} className="flex gap-8">
                  <div className="flex gap-2">
                    {row.slice(0, 6).map(renderSeat)}
                  </div>
                  <div className="w-12 border-x border-dashed border-border/20 relative before:content-[''] before:absolute before:inset-0 before:bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTIgMmgxNnYxNkgyeiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] opacity-30 flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground rotate-90 tracking-[0.3em]">AISLE</span>
                  </div>
                  <div className="flex gap-2">
                    {row.slice(6, 12).map(renderSeat)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full flex flex-col items-center border border-border/50 rounded-xl p-6 bg-card/30 relative overflow-hidden mt-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
            <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-6">NON-AC SECTION - ₹1,500/mo</h3>
            <div className="flex flex-col gap-4">
              {ROWS.nonAc.slice(0, 3).map((row, i) => (
                <div key={`nac-row-${i}`} className="flex gap-8">
                  <div className="flex gap-2">
                    {row.slice(0, 6).map(renderSeat)}
                  </div>
                  <div className="w-12 border-x border-dashed border-border/20 opacity-30"></div>
                  <div className="flex gap-2">
                    {row.slice(6, 12).map(renderSeat)}
                  </div>
                </div>
              ))}
              
              <div className="flex justify-center mt-4">
                <div className="flex gap-2 p-3 border border-border/40 rounded-lg bg-background/50 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-[10px] text-muted-foreground tracking-wider">3-CABIN</div>
                  {ROWS.nonAc[3].map(renderSeat)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {selectedSeat && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-40 animate-in slide-in-from-bottom-full">
          <div className="container max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Selected Seat</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-primary">{selectedSeat.seatNumber}</p>
                <p className="text-sm">({selectedSeat.section})</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-xl font-bold">₹{selectedSeat.price}/mo</p>
              </div>
              <Link href={`/book/${selectedSeat.id}?month=${month}`}>
                <Button size="lg" className="w-full sm:w-auto font-bold text-lg px-8">
                  Book This Seat
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
