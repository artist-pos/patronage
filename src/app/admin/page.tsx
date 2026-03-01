import Link from "next/link";

export const metadata = { title: "Admin — Patronage" };

const tools = [
  {
    href: "/admin/upload",
    label: "Upload Opportunities",
    description: "Bulk-import listings from a CSV file.",
  },
];

export default function AdminPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1 border-b border-border pb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Admin
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>
      <ul className="space-y-0 divide-y divide-border">
        {tools.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="flex items-center justify-between py-4 group"
            >
              <div>
                <p className="text-sm font-medium group-hover:underline underline-offset-2">
                  {t.label}
                </p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <span className="text-muted-foreground text-sm">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
