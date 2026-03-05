import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col items-center gap-2 text-xs text-muted-foreground text-center">
        <Link href="/partners" className="text-foreground font-medium hover:opacity-80 transition-opacity">
          For Partners
        </Link>
        <a href="mailto:hello@patronage.nz" className="hover:text-foreground transition-colors">
          hello@patronage.nz
        </a>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5">
          <span>© {new Date().getFullYear()} Patronage</span>
          <span>Connecting artists with opportunity in Aotearoa and beyond.</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-x-3 gap-y-1 opacity-60">
          <Link href="/terms" className="hover:opacity-100 transition-opacity">
            Terms of Service
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link href="/privacy" className="hover:opacity-100 transition-opacity">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
