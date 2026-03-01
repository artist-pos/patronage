import Link from "next/link";
import { isAdmin } from "@/lib/admin";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/artists", label: "Artists" },
  { href: "/admin/opportunities", label: "Opportunities" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/upload", label: "CSV Upload" },
  { href: "/admin/digest", label: "Digest" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold">Access denied.</p>
          <p className="text-xs text-muted-foreground">
            This area requires an admin account.
          </p>
          <Link href="/" className="text-xs underline underline-offset-2">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
      <div className="border-b border-border pb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
          Admin
        </p>
        <nav className="flex gap-6 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
