import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export function ReviewCard({ name, rating, text }: { name: string; rating: number; text: string }) {
  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur h-full">
      <CardContent className="p-6 flex flex-col gap-4 h-full">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${i < rating ? "fill-primary text-primary" : "text-muted"}`}
            />
          ))}
        </div>
        <p className="text-sm text-card-foreground flex-1 italic leading-relaxed">
          "{text}"
        </p>
        <div className="flex items-center gap-3 pt-4 border-t border-border/50">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
            {name.charAt(0).toUpperCase()}
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{name}</p>
        </div>
      </CardContent>
    </Card>
  );
}
