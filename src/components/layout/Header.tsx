import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Patronage
        </Link>
        <nav className="flex items-center gap-8 text-sm">
          <Link href="/opportunities" className="text-muted-foreground hover:text-foreground transition-colors">
            Opportunities
          </Link>
          <Link href="/artists" className="text-muted-foreground hover:text-foreground transition-colors">
            Artists
          </Link>
          <Link href="/partners" className="text-muted-foreground hover:text-foreground transition-colors">
            For Partners
          </Link>
        </nav>
      </div>
    </header>
  );
}
