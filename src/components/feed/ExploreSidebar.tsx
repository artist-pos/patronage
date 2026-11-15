"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISCIPLINE_OPTIONS } from "@/lib/disciplines";

const KIND_OPTIONS = [
  { value: "process", label: "Process" },
  { value: "new", label: "New work" },
  { value: "event", label: "Events" },
  { value: "milestone", label: "Milestones" },
  { value: "av", label: "Audio and video" },
  { value: "writing", label: "Writing" },
] as const;

interface Props {
  isLoggedIn: boolean;
  regions: { id: string; name: string }[];
  /** "New update +" for signed-in artists; sits at the top of the sidebar. */
  postButton?: React.ReactNode;
  /** Server-rendered blocks below the filters: This week, then the noticeboard. */
  children?: React.ReactNode;
}

/**
 * Explore's left column, like the filters on Funding: tools that shape the
 * feed first (show, kind, discipline, region), then This week and the
 * noticeboard. From lg up it's a sticky sidebar; below that the filters open
 * from a Filters button and the two blocks become tiles in the feed.
 */
export function ExploreSidebar({ isLoggedIn, regions, postButton, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const audience = searchParams.get("audience") ?? "everyone";
  const kinds = (searchParams.get("kind") ?? "").split(",").filter(Boolean);
  const discipline = searchParams.get("discipline");
  const region = searchParams.get("region");
  const activeCount = kinds.length + (discipline ? 1 : 0) + (region ? 1 : 0) + (audience !== "everyone" ? 1 : 0);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "everyone") params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  function toggleKind(k: string) {
    const next = kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k];
    setParam("kind", next.length ? next.join(",") : null);
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  const label = "mb-2.5 block t-section-label";
  const rowCls = (active: boolean) =>
    `flex w-full items-center gap-2.5 py-1.5 text-left text-sm transition-colors ${active ? "text-foreground" : "text-[color:var(--fg-muted)] hover:text-foreground"}`;

  const filters = (
    <div className="space-y-6">
      {isLoggedIn && (
        <div role="radiogroup" aria-label="Show">
          <span className={label}>Show</span>
          <div className="grid grid-cols-3 border border-foreground">
            {([["everyone", "All"], ["following", "Following"], ["subscribed", "Supporting"]] as const).map(([v, l], i) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={audience === v}
                onClick={() => setParam("audience", v)}
                className={`py-2 font-mono text-[11px] transition-colors ${i > 0 ? "border-l border-foreground" : ""} ${audience === v ? "bg-foreground text-white" : "hover:bg-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className={label}>Kind</span>
        <div className="flex flex-col">
          {KIND_OPTIONS.map((k) => {
            const on = kinds.includes(k.value);
            return (
              <button key={k.value} type="button" role="checkbox" aria-checked={on} onClick={() => toggleKind(k.value)} className={rowCls(on)}>
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-foreground ${on ? "bg-foreground" : "bg-card"}`}>
                  {on && <span className="h-[3px] w-[6px] -translate-y-px -rotate-45 border-b-[1.5px] border-l-[1.5px] border-white" />}
                </span>
                {k.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <span className={label}>Discipline</span>
          <Select value={discipline ?? "all"} onValueChange={(v) => setParam("discipline", v)}>
            <SelectTrigger className="w-full font-mono text-xs" aria-label="Discipline">
              <SelectValue placeholder="Any discipline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any discipline</SelectItem>
              {DISCIPLINE_OPTIONS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <span className={label}>Region</span>
          <Select value={region ?? "all"} onValueChange={(v) => setParam("region", v)}>
            <SelectTrigger className="w-full font-mono text-xs" aria-label="Region">
              <SelectValue placeholder="Anywhere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anywhere</SelectItem>
              {regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => router.push(pathname, { scroll: false })}
          className="font-mono text-xs text-[color:var(--fg-muted)] underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Clear filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Sidebar from lg up. Scrolls on its own when taller than the screen. */}
      <aside className="hidden lg:sticky lg:top-[72px] lg:block lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:pb-4 scrollbar-hide">
        <div className="space-y-6">
          {postButton && <div className="[&>button]:w-full">{postButton}</div>}
          {filters}
          {children}
        </div>
      </aside>

      {/* Below lg: Filters button and the New update button, side by side. */}
      <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="btn btn-outline btn-sm min-h-[40px] gap-2"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center bg-foreground px-1 text-[10px] text-white">{activeCount}</span>
          )}
        </button>
        {postButton}
      </div>

      {mobileOpen && createPortal(
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setMobileOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            className="absolute inset-y-0 left-0 w-[86%] max-w-sm overflow-y-auto border-r border-border bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <p className="t-heading">Filters</p>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close" className="p-2.5 text-[color:var(--fg-muted)] transition-colors hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            {filters}
            <button type="button" onClick={() => setMobileOpen(false)} className="btn btn-primary mt-8 w-full">
              Show updates
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
