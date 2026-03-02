import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col items-center gap-2 text-xs text-muted-foreground text-center">
        <Link href="/partners" className="hover:text-foreground transition-colors">
          For Partners
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5">
          <span>© {new Date().getFullYear()} Patronage</span>
          <span>Connecting artists with opportunity in Aotearoa and beyond.</span>
        </div>
      </div>
    </footer>
  );
}
