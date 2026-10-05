"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { getSections, sectionFromPathname } from "./sidebar-config";

interface Props {
  role: string;
  sectionDots?: Record<string, boolean>;
  sectionCounts?: Record<string, number>;
  lockedSections?: string[];
  children: React.ReactNode;
}

export function StudioNav({ role, sectionDots, sectionCounts, lockedSections, children }: Props) {
  const pathname = usePathname();
  const activeSection = sectionFromPathname(pathname);
  const locked = new Set(lockedSections ?? []);
  const { primary, secondary } = getSections(role);

  return (
    <>
      {/* Mobile: horizontal scrolling tabs */}
      <div className="flex lg:hidden gap-0 border-b border-black overflow-x-auto mb-8">
        {[...primary, ...secondary].map(({ id, label, href }) => (
          <Link
            key={id}
            href={href}
            className={`flex items-center gap-1 px-3 py-3 text-sm whitespace-nowrap transition-colors ${
              activeSection === id
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {locked.has(id) && <Lock className="w-3 h-3 shrink-0" />}
          </Link>
        ))}
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        <nav className="hidden lg:block w-[200px] shrink-0 sticky top-[72px] space-y-6">

          {/* Primary */}
          <div className="space-y-0.5">
            {primary.map(({ id, label, href }) => (
              <NavLink
                key={id}
                href={href}
                label={label}
                active={activeSection === id}
                locked={locked.has(id)}
                dot={sectionDots?.[id]}
                count={sectionCounts?.[id]}
              />
            ))}
          </div>

          <div className="border-t border-border" />

          {/* Secondary */}
          <div className="space-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
              Settings & tools
            </p>
            {secondary.map(({ id, label, href }) => (
              <NavLink
                key={id}
                href={href}
                label={label}
                active={activeSection === id}
                locked={locked.has(id)}
                dot={sectionDots?.[id]}
                count={sectionCounts?.[id]}
              />
            ))}
          </div>

        </nav>

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </>
  );
}

function NavLink({
  href, label, active, locked, dot, count,
}: {
  href: string; label: string; active: boolean;
  locked: boolean; dot?: boolean; count?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between px-3 py-2 text-sm rounded-sm transition-colors ${
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      }`}
    >
      <span>{label}</span>
      <div className="flex items-center gap-1.5">
        {locked && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Locked" />}
        {count != null && count > 0 && (
          <span className="text-xs tabular-nums bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
            {count}
          </span>
        )}
        {dot && !count && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="Needs attention" />
        )}
      </div>
    </Link>
  );
}
