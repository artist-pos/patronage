import Link from "next/link";
import { SIDEBAR_SECTIONS, SIDEBAR_GROUPS, getSectionHref } from "./sidebar-config";

interface Props {
  activeSection: string;
  /** Map of section id → whether to render a "needs attention" dot. */
  sectionDots?: Record<string, boolean>;
  children: React.ReactNode;
}

export function StudioNav({ activeSection, sectionDots, children }: Props) {
  return (
    <>
      {/* Mobile: horizontal section tabs */}
      <div className="flex lg:hidden gap-0 border-b border-black overflow-x-auto mb-8">
        {SIDEBAR_SECTIONS.map(({ id, label }) => (
          <Link
            key={id}
            href={getSectionHref(id)}
            className={`px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              activeSection === id
                ? "font-semibold border-b-2 border-black -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        <nav className="hidden lg:block w-[200px] shrink-0 sticky top-8 space-y-6">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group} className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">
                {group}
              </p>
              {SIDEBAR_SECTIONS.filter((s) => s.group === group).map(({ id, label }) => (
                <Link
                  key={id}
                  href={getSectionHref(id)}
                  className={`flex items-center justify-between px-3 py-2 text-sm rounded-sm transition-colors ${
                    activeSection === id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span>{label}</span>
                  {sectionDots?.[id] && (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"
                      aria-label="Needs attention"
                    />
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </>
  );
}
