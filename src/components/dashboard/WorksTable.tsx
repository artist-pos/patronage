"use client";

import { useState } from "react";
import { toggleFeaturedWork, toggleHidePortfolioWork, toggleHideAvailable, unlistWork } from "@/app/profile/available-work-actions";

interface PortfolioRow {
  id: string;
  url: string;
  caption: string | null;
  description: string | null;
  is_featured: boolean;
  hide_from_archive: boolean;
  position: number;
  created_at: string;
  content_type: string;
}

interface AvailableRow {
  id: string;
  url: string;
  caption: string | null;
  description: string | null;
  price: string | null;
  price_currency: string;
  is_available: boolean;
  hide_available: boolean;
  position: number;
  created_at: string;
}

interface SoldRow {
  id: string;
  url: string;
  caption: string | null;
  price: string | null;
  price_currency: string;
  created_at: string;
  current_owner_id: string;
}

interface Props {
  section: "portfolio" | "available" | "sold";
  portfolioWorks: PortfolioRow[];
  availableWorks: AvailableRow[];
  soldWorks: SoldRow[];
  featuredCount: number;
}

function formatPrice(price: string | null, currency: string): string {
  if (!price) return "—";
  if (price === "POA") return "Price on application";
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  return `${currency} ${num.toLocaleString("en-NZ")}`;
}

export function WorksTable({ section, portfolioWorks, availableWorks, soldWorks, featuredCount }: Props) {
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>(portfolioWorks);
  const [available, setAvailable] = useState<AvailableRow[]>(availableWorks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  // Portfolio actions
  async function toggleFeatured(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleFeaturedWork(id, !current, featuredCount);
    if (result.error) { showError(result.error); }
    else { setPortfolio(prev => prev.map(w => w.id === id ? { ...w, is_featured: !current } : w)); }
    setBusy(null);
  }

  async function toggleHidePortfolio(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHidePortfolioWork(id, !current);
    if (result.error) { showError(result.error); }
    else { setPortfolio(prev => prev.map(w => w.id === id ? { ...w, hide_from_archive: !current } : w)); }
    setBusy(null);
  }

  // Available work actions
  async function toggleHide(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHideAvailable(id, !current);
    if (result.error) { showError(result.error); }
    else { setAvailable(prev => prev.map(w => w.id === id ? { ...w, hide_available: !current } : w)); }
    setBusy(null);
  }

  async function handleUnlist(id: string) {
    if (!confirm("Remove this work from your available listings?")) return;
    setBusy(id);
    const result = await unlistWork(id);
    if (result.error) { showError(result.error); }
    else { setAvailable(prev => prev.filter(w => w.id !== id)); }
    setBusy(null);
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-xs text-destructive border border-destructive/30 px-3 py-2">
          {error}
        </div>
      )}

      {section === "portfolio" && (
        <>
          {portfolio.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">No portfolio works yet.</p>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {portfolio.map(work => (
                <div key={work.id} className="flex items-center gap-4 py-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 shrink-0 overflow-hidden bg-muted border border-border">
                    {work.content_type === "image" || !work.content_type ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={work.url} alt={work.caption ?? ""} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{work.content_type}</span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(work.created_at).getFullYear()}
                    </p>
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    {work.is_featured && (
                      <span className="text-[10px] border border-black px-1.5 py-0.5 leading-none font-medium">
                        ★ Featured
                      </span>
                    )}
                    {work.hide_from_archive && (
                      <span className="text-[10px] border border-border text-muted-foreground px-1.5 py-0.5 leading-none">
                        Hidden
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleFeatured(work.id, work.is_featured)}
                      disabled={busy === work.id}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {work.is_featured ? "Unfeature" : "Feature"}
                    </button>
                    <button
                      onClick={() => toggleHidePortfolio(work.id, work.hide_from_archive)}
                      disabled={busy === work.id}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {work.hide_from_archive ? "Show" : "Hide"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === "available" && (
        <>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">No available works listed.</p>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {available.map(work => (
                <div key={work.id} className="flex items-center gap-4 py-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 shrink-0 overflow-hidden bg-muted border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={work.url} alt={work.caption ?? ""} className="w-full h-full object-cover" />
                  </div>

                  {/* Title + price */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatPrice(work.price, work.price_currency)}
                    </p>
                  </div>

                  {/* Status */}
                  {work.hide_available && (
                    <span className="text-[10px] border border-border text-muted-foreground px-1.5 py-0.5 leading-none shrink-0">
                      Hidden
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => toggleHide(work.id, work.hide_available)}
                      disabled={busy === work.id}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {work.hide_available ? "Show" : "Hide"}
                    </button>
                    <button
                      onClick={() => handleUnlist(work.id)}
                      disabled={busy === work.id}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      Unlist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === "sold" && (
        <>
          {soldWorks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">No transferred works yet.</p>
          ) : (
            <div className="divide-y divide-border border-t border-border">
              {soldWorks.map(work => (
                <div key={work.id} className="flex items-center gap-4 py-3">
                  <div className="w-12 h-12 shrink-0 overflow-hidden bg-muted border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={work.url} alt={work.caption ?? ""} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(work.created_at).toLocaleDateString("en-NZ", { year: "numeric", month: "short" })}
                      {work.price ? ` · ${formatPrice(work.price, work.price_currency)}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] border border-border text-muted-foreground px-1.5 py-0.5 leading-none shrink-0">
                    Transferred
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
