import { Link } from "wouter";
import { BookOpen } from "lucide-react";

const PHONE = "9014463623";
const PHONE_HREF = `tel:+91${PHONE}`;
const WHATSAPP_HREF = `https://wa.me/91${PHONE}`;

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col font-sans selection:bg-primary/30">
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Dedicated contact strip — always visible on all screen sizes */}
        <div className="bg-primary/90 text-white text-xs">
          <div className="container mx-auto px-4 md:px-8 h-8 flex items-center justify-end gap-4">
            <a
              href={PHONE_HREF}
              className="flex items-center gap-1.5 hover:text-white/80 transition-colors font-semibold"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {PHONE}
            </a>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white/80 transition-colors font-semibold"
            >
              <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
              WhatsApp
            </a>
          </div>
        </div>

        {/* Main nav bar */}
        <div className="border-b border-border/40">
          <div className="container mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">Lucky Reading Room</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">Admin</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border/40 bg-gray-50 mt-auto">
        {/* Contact strip */}
        <div className="bg-primary text-white">
          <div className="container mx-auto px-4 md:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm text-white/80 uppercase tracking-wider mb-1">Contact Us</p>
              <p className="text-lg font-bold">Lucky Reading Room — SR Nagar, Hyderabad</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={PHONE_HREF}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 text-sm font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {PHONE}
              </a>
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] transition-colors rounded-full px-4 py-2 text-sm font-semibold"
              >
                <WhatsAppIcon className="w-4 h-4" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="container mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <div className="flex items-center gap-2 opacity-80">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Lucky Reading Room</span>
          </div>
          <p className="text-sm text-muted-foreground">
            SR Nagar, Hyderabad &nbsp;·&nbsp;
            <a href={PHONE_HREF} className="hover:text-primary transition-colors">{PHONE}</a>
          </p>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Lucky Reading Room. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
