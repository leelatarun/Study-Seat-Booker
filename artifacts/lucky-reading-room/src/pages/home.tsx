import { useState, useEffect, useCallback } from "react";
import { format, addMonths } from "date-fns";
import { HeroCarousel } from "@/components/hero-carousel";
import { ReviewCard } from "@/components/review-card";
import { SeatSelector } from "@/components/seat-selector";
import { useListSeats } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const REVIEWS = [
  {
    name: "harika jasti",
    rating: 5,
    text: "Reading room has a quiet ambiance, clean and no disturbance whatsoever, no traffic sounds and we get a small cupboard above and personal light apart from tube lights. I've seen other reading rooms in that area but this one is really good. Highly recommend."
  },
  {
    name: "Ramesh Nayak",
    rating: 4,
    text: "Ambience is top notch; the best in SR Nagar; the owner herself takes efforts in ensuring clean, neat and shiny environment; the white floors, walls and cabins."
  },
  {
    name: "Tarun Leela",
    rating: 5,
    text: "Great study hall, management is very responsive and helps when needed, all facilities are top notch, would suggest this hall to anyone."
  },
  {
    name: "Kaisarlla Rama Sivaji",
    rating: 5,
    text: "Super maintenance peaceful environment for students to study. With High speed internet. 24 hours open."
  },
  {
    name: "viswa 123",
    rating: 5,
    text: "It's a perfect environment to study peacefully with complete concentration. After visiting this place I was very much impressed with its ambience."
  },
  {
    name: "Anil Mikey",
    rating: 5,
    text: "I recently found an excellent study hall around the SR Nagar and Ameerpeet area. It offers great amenities, making it an ideal place for focused study sessions. What really sets this place apart is the owner, who is incredibly polite."
  }
];

// Group reviews into pairs
const PAIRS = Array.from({ length: Math.ceil(REVIEWS.length / 2) }, (_, i) =>
  REVIEWS.slice(i * 2, i * 2 + 2)
);

export default function Home() {
  const [month, setMonth] = useState("2026-07");
  const [reviewPage, setReviewPage] = useState(0);
  const [animating, setAnimating] = useState(false);

  const { data: seats = [], isLoading } = useListSeats(
    { month },
    { query: { queryKey: ["/api/seats", { month }] } }
  );

  const goToPage = useCallback((next: number) => {
    setAnimating(true);
    setTimeout(() => {
      setReviewPage(next);
      setAnimating(false);
    }, 250);
  }, []);

  const prev = () => goToPage(reviewPage === 0 ? PAIRS.length - 1 : reviewPage - 1);
  const next = useCallback(() => goToPage(reviewPage === PAIRS.length - 1 ? 0 : reviewPage + 1), [reviewPage, goToPage]);

  useEffect(() => {
    const timer = setInterval(next, 20000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <div className="flex flex-col pb-32">
      <HeroCarousel />

      <section className="py-16 md:py-20 container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">What Our Students Say</h2>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full"></div>
        </div>

        <div className="relative max-w-3xl mx-auto">
          {/* Review cards */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300 ${
              animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            {PAIRS[reviewPage]?.map((review, i) => (
              <ReviewCard key={i} {...review} />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dots */}
            <div className="flex gap-2">
              {PAIRS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToPage(i)}
                  className={`rounded-full transition-all ${
                    i === reviewPage ? "bg-primary w-5 h-2" : "bg-gray-200 w-2 h-2"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary transition-colors shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <div className="h-px bg-gray-100 max-w-5xl mx-auto w-full my-4"></div>

      <section id="book" className="container mx-auto">
        <SeatSelector
          seats={seats}
          month={month}
          onMonthChange={setMonth}
          isLoading={isLoading}
        />
      </section>
    </div>
  );
}
