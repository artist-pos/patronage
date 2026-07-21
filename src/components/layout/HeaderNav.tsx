"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Single source of truth for the primary nav destinations. NavBar's mobile
// drawer imports this too.
export const NAV_LINKS = [
  { href: "/feed", label: "Explore" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/artists", label: "Artists" },
];

/**
 * Desktop primary nav — v2 treatment: Geist Mono, lowercase, left-aligned
 * inline after the logo. Active route carries the civic-teal 2px underline
 * (the only place teal appears in the header nav — interactive marks only).
 *
 * Role-aware: Studio lives in the account menu (NavBar), not here — signed-in
 * artists reach it from there, same as settings. Partners is a marketing/
 * recruitment link — shown to signed-out visitors and to partner accounts,
 * hidden for artists/patrons/admins who already have their own dashboard.
 */
export function HeaderNav({ role, isLoggedIn = false }: { role?: string | null; isLoggedIn?: boolean }) {
  const pathname = usePathname();

  const showPartners = !isLoggedIn || role === "partner";
  const links = [
    ...NAV_LINKS,
    ...(showPartners ? [{ href: "/partners", label: "Partners" }] : []),
  ];

  return (
    <nav className="hidden sm:flex items-stretch h-full">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center border-b-2 -mb-px px-3.5 text-[13px] transition-colors ${
              active
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
