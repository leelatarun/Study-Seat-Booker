import { useState, useEffect, useCallback } from "react";
import { HeroCarousel } from "@/components/hero-carousel";
import { ReviewCard } from "@/components/review-card";
import { SeatSelector } from "@/components/seat-selector";
import { useListSeats } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import photo1 from "@assets/Study_Hall_Photo_1__1781170816775.jpg";
import photo2 from "@assets/Study_hall_photo_2__1781170816775.jpg";
import photo3 from "@assets/Study_Hall_photo_3_1781170816775.png";
import photo4 from "@assets/Studyhall_phto_4_1781170816775.png";
import photo5 from "@assets/Studyhall_photo_5_1781170816775.png";
import photo6 from "@assets/studyhall_photo_6_1781170816775.png";
import photo7 from "@assets/studyhall_photo_7_1781170816775.png";

const GALLERY_PHOTOS = [photo1, photo2, photo3, photo4, photo5, photo6, photo7];

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

const PAIRS = Array.from({ length: Math.ceil(REVIEWS.length / 2) }, (_, i) =>
  REVIEWS.slice(i * 2, i * 2 + 2)
);

const FACILITIES = [
  {
    label: "24×7 Cabins",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Lockers",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    label: "Fast WiFi",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
  },
  {
    label: "Separate Washrooms",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Drinking Water",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    label: "Shoe Rack",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
];

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

      {/* Reviews */}
      <section className="py-16 md:py-20 container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">What Our Students Say</h2>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full"></div>
        </div>

        <div className="relative max-w-3xl mx-auto">
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300 ${
              animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            {PAIRS[reviewPage]?.map((review, i) => (
              <ReviewCard key={i} {...review} />
            ))}
          </div>

          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
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

      {/* Facilities strip */}
      <section className="bg-primary/5 border-y border-primary/10 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <h3 className="text-base font-bold text-primary uppercase tracking-widest">Facilities Available</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full max-w-4xl">
              {FACILITIES.map(({ label, icon }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-2 bg-white rounded-xl px-3 py-4 shadow-sm border border-primary/10"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {icon}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-gray-100 max-w-5xl mx-auto w-full my-4"></div>

      {/* Seat booking */}
      <section id="book" className="container mx-auto">
        <SeatSelector
          seats={seats}
          month={month}
          onMonthChange={setMonth}
          isLoading={isLoading}
        />
      </section>

      {/* Gallery + Map panel */}
      <section className="container mx-auto px-4 py-14">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-serif text-primary mb-3">Visit Us</h2>
          <p className="text-gray-500 text-sm">Take a look inside and find us on the map</p>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full mt-3"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Photo grid — left half, all 7 photos, scrollable */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Photo Gallery</p>
            <div className="overflow-y-auto max-h-[480px] pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              <div className="grid grid-cols-2 gap-2">
                {GALLERY_PHOTOS.map((src, i) => (
                  <div
                    key={i}
                    className={`overflow-hidden rounded-xl bg-gray-100 ${i === 0 ? "col-span-2 h-52" : "h-36"}`}
                  >
                    <img
                      src={src}
                      alt={`Lucky Reading Room ${i + 1}`}
                      className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map — right half */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Our Location</p>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm h-full min-h-[360px] flex flex-col">
              <iframe
                title="Lucky Reading Room Location"
                src="https://maps.google.com/maps?q=Lucky+Reading+Room,SR+Nagar,Hyderabad&output=embed"
                className="w-full flex-1 min-h-[280px]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="bg-white border-t border-gray-100 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Lucky Reading Room</p>
                  <p className="text-xs text-gray-500">SR Nagar, Hyderabad</p>
                </div>
                <a
                  href="https://share.google/FytDq22pApyTsWAxI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Get Directions
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
