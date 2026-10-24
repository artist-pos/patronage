import Link from "next/link";

const TABS = [
  { href: "/admin/rabobank", label: "Dates, links and survey" },
  { href: "/admin/rabobank/artists", label: "Artists" },
  { href: "/admin/rabobank/shortlist", label: "Shortlist" },
  { href: "/admin/rabobank/reactions", label: "Reactions" },
  { href: "/admin/rabobank/log", label: "Event log" },
];

export default function RabobankAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <nav aria-label="Rabobank pilot" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border pb-3 text-sm">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="text-muted-foreground hover:text-foreground">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
