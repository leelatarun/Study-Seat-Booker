import useEmblaCarousel from "embla-carousel-react";
import { useEffect } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

import photo1 from "@assets/Study_Hall_Photo_1__1781170816775.jpg";
import photo2 from "@assets/Study_hall_photo_2__1781170816775.jpg";
import photo3 from "@assets/Study_Hall_photo_3_1781170816775.png";
import photo4 from "@assets/Studyhall_phto_4_1781170816775.png";
import photo5 from "@assets/Studyhall_photo_5_1781170816775.png";
import photo6 from "@assets/studyhall_photo_6_1781170816775.png";
import photo7 from "@assets/studyhall_photo_7_1781170816775.png";

const IMAGES = [photo1, photo2, photo3, photo4, photo5, photo6, photo7];

export function HeroCarousel() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  useEffect(() => {
    if (!emblaApi) return;
    
    // Auto-play
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000);

    return () => clearInterval(interval);
  }, [emblaApi]);

  const scrollPrev = () => emblaApi && emblaApi.scrollPrev();
  const scrollNext = () => emblaApi && emblaApi.scrollNext();

  return (
    <div className="relative w-full group">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex h-[50vh] md:h-[70vh]">
          {IMAGES.map((src, index) => (
            <div className="flex-[0_0_100%] min-w-0 relative" key={index}>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent z-10 mix-blend-multiply pointer-events-none" />
              <img
                src={src}
                alt={`Study Hall Photo ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            </div>
          ))}
        </div>
      </div>
      
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-4 pointer-events-none bg-black/40">
        <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-4 tracking-tight drop-shadow-lg">
          Lucky Reading Room
        </h1>
        <p className="text-xl md:text-2xl text-white/90 font-medium max-w-2xl drop-shadow-md">
          A calm, focused, and premium space for your studies.
        </p>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 rounded-full bg-background/20 backdrop-blur border-white/20 text-white hover:bg-background/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={scrollPrev}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 rounded-full bg-background/20 backdrop-blur border-white/20 text-white hover:bg-background/40 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={scrollNext}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );
}
