"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { PRIMARY_SECTIONS, SECONDARY_SECTIONS, getSectionHref } from "./sidebar-config";

interface Props {
  activeSection: string;
  sectionDots?: Record<string, boolean>;
  sectionCounts?: Record<string, number>;
  lockedSections?: string[];
  children: React.ReactNode;
}

export function StudioNav({ activeSection, sectionDots, sectionCounts, lockedSections, children }: Props) {
  const locked = new Set(lockedSections ?? []);

  return (
    <>
      {/* Mobile: horizontal scrolling tabs — primary only */}
      <div className="flex lg:hidden gap-0 border-b border-black overflow-x-auto mb-8">
        {[...PRIMARY_SECTIONS, ...SECONDARY_SECTIONS].map(({ id, label }) => (
          <Link
            key={id}
            href={getSectionHref(id)}
            className={`flex items-center gap-1 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
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
            {PRIMARY_SECTIONS.map(({ id, label }) => (
              <NavLink
                key={id}
                id={id}
                label={label}
                active={activeSection === id}
                locked={locked.has(id)}
                dot={sectionDots?.[id]}
                count={sectionCounts?.[id]}
              />
            ))}
          </div>

          <div className="border-t border-border" />

          {/* Secondary — settings & tools */}
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
              Settings & tools
            </p>
            {SECONDARY_SECTIONS.map(({ id, label }) => (
              <NavLink
                key={id}
                id={id}
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
  id, label, active, locked, dot, count,
}: {
  id: string; label: string; active: boolean;
  locked: boolean; dot?: boolean; count?: number;
}) {
  return (
    <Link
      href={getSectionHref(id)}
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
          <span className="text-[10px] tabular-nums bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 leading-none">
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
