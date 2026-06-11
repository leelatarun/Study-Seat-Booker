import { Link } from "wouter";
import { BookOpen } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">Lucky Reading Room</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
            <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">Admin</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/40 py-8 md:py-12 mt-auto">
        <div className="container mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="flex items-center gap-2 opacity-80">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Lucky Reading Room</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Lucky Reading Room. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
