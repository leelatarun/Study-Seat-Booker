import { useState } from "react";
import { format, addMonths } from "date-fns";
import { HeroCarousel } from "@/components/hero-carousel";
import { ReviewCard } from "@/components/review-card";
import { SeatSelector } from "@/components/seat-selector";
import { useListSeats } from "@workspace/api-client-react";

const REVIEWS = [
  {
    name: "harika jasti",
    rating: 5,
    text: "Reading room has a quiet ambiance, clean and no disturbance whatsoever, no traffic sounds and we get a small cupboard above and personal light apart from tube lights. I've seen other reading rooms in that area but this one is really good. Highly recommend."
  },
  {
    name: "CA Praveen Kumar",
    rating: 5,
    text: "Mithra Reading Room is an outstanding place for students looking for a conducive study environment. The atmosphere is incredibly pleasant and quiet, making it easy to focus on your studies. The private cabin spaces are a fantastic feature."
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

export default function Home() {
  // Default to July 2026
  const [month, setMonth] = useState("2026-07");

  const { data: seats = [], isLoading } = useListSeats(
    { month },
    { query: { queryKey: ["/api/seats", { month }] } }
  );

  return (
    <div className="flex flex-col pb-32">
      <HeroCarousel />
      
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-primary mb-4">What Our Students Say</h2>
          <div className="w-16 h-1 bg-primary mx-auto rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {REVIEWS.map((review, i) => (
            <div key={i} className={i > 3 ? "hidden lg:block xl:block" : ""}>
              <ReviewCard {...review} />
            </div>
          ))}
        </div>
      </section>

      <div className="h-px bg-border/50 max-w-5xl mx-auto w-full my-8"></div>

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
