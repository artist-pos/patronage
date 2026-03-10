"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  toggleFeaturedWork,
  toggleHidePortfolioWork,
  toggleHideAvailable,
  toggleHidePrice,
  deletePortfolioWork,
  unlistWork,
} from "@/app/profile/available-work-actions";
import {
  requestArtworkDeletion,
  removeFromArtistProfile,
} from "@/app/profile/artwork-delete-actions";

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
  hide_price: boolean;
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
  hidden_from_artist: boolean;
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

function ActionBtn({
  onClick,
  disabled,
  children,
  destructive,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[11px] transition-colors disabled:opacity-40 whitespace-nowrap ${
        destructive
          ? "text-destructive hover:opacity-70"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

export function WorksTable({ section, portfolioWorks, availableWorks, soldWorks, featuredCount }: Props) {
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioRow[]>(portfolioWorks);
  const [available, setAvailable] = useState<AvailableRow[]>(availableWorks);
  const [sold, setSold] = useState<SoldRow[]>(soldWorks);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 4000);
  }

  // ── Portfolio actions ────────────────────────────────────────────────────────

  async function toggleFeatured(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleFeaturedWork(id, !current, featuredCount);
    if (result.error) showError(result.error);
    else setPortfolio(prev => prev.map(w => w.id === id ? { ...w, is_featured: !current } : w));
    setBusy(null);
  }

  async function toggleHidePortfolio(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHidePortfolioWork(id, !current);
    if (result.error) showError(result.error);
    else setPortfolio(prev => prev.map(w => w.id === id ? { ...w, hide_from_archive: !current } : w));
    setBusy(null);
  }

  async function handleDeletePortfolio(id: string) {
    if (!confirm("Permanently delete this work? This cannot be undone.")) return;
    setBusy(id);
    const result = await deletePortfolioWork(id);
    if (result.error) showError(result.error);
    else setPortfolio(prev => prev.filter(w => w.id !== id));
    setBusy(null);
  }

  // ── Available work actions ───────────────────────────────────────────────────

  async function toggleHide(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHideAvailable(id, !current);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.map(w => w.id === id ? { ...w, hide_available: !current } : w));
    setBusy(null);
  }

  async function togglePrice(id: string, current: boolean) {
    setBusy(id);
    const result = await toggleHidePrice(id, !current);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.map(w => w.id === id ? { ...w, hide_price: !current } : w));
    setBusy(null);
  }

  async function handleUnlist(id: string) {
    if (!confirm("Remove this work from your available listings? It won't be deleted.")) return;
    setBusy(id);
    const result = await unlistWork(id);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.filter(w => w.id !== id));
    setBusy(null);
  }

  async function handleDeleteAvailable(id: string) {
    if (!confirm("Permanently delete this work? This cannot be undone.")) return;
    setBusy(id);
    const result = await requestArtworkDeletion(id);
    if (result.error) showError(result.error);
    else setAvailable(prev => prev.filter(w => w.id !== id));
    setBusy(null);
  }

  // ── Sold work actions ────────────────────────────────────────────────────────

  async function handleRemoveFromProfile(id: string) {
    setBusy(id);
    const result = await removeFromArtistProfile(id);
    if (result.error) showError(result.error);
    else setSold(prev => prev.map(w => w.id === id ? { ...w, hidden_from_artist: true } : w));
    setBusy(null);
  }

  async function handleRequestDeletion(id: string) {
    if (!confirm("Send a deletion request to the collector? They'll need to approve before the work is removed.")) return;
    setBusy(id);
    const result = await requestArtworkDeletion(id);
    if (result.error) { showError(result.error); setBusy(null); return; }
    if (result.conversationId) router.push(`/messages/${result.conversationId}`);
    setBusy(null);
  }

  const divider = <span className="text-border select-none">·</span>;

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-xs text-destructive border border-destructive/30 px-3 py-2">
          {error}
        </div>
      )}

      {/* ── Portfolio ── */}
      {section === "portfolio" && (
        portfolio.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No portfolio works yet. Upload below.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {portfolio.map(work => (
              <div key={work.id} className="flex items-center gap-4 py-3">
                <Thumb url={work.url} caption={work.caption} type={work.content_type} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(work.created_at).getFullYear()}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {work.is_featured && <Badge>★ Featured</Badge>}
                  {work.hide_from_archive && <Badge muted>Hidden</Badge>}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[200px]">
                  <ActionBtn onClick={() => toggleFeatured(work.id, work.is_featured)} disabled={busy === work.id}>
                    {work.is_featured ? "Unfeature" : "Feature"}
                  </ActionBtn>
                  {divider}
                  <ActionBtn onClick={() => toggleHidePortfolio(work.id, work.hide_from_archive)} disabled={busy === work.id}>
                    {work.hide_from_archive ? "Show" : "Hide"}
                  </ActionBtn>
                  {divider}
                  <ActionBtn onClick={() => handleDeletePortfolio(work.id)} disabled={busy === work.id} destructive>
                    Delete
                  </ActionBtn>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Available ── */}
      {section === "available" && (
        available.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No available works listed.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {available.map(work => (
              <div key={work.id} className="flex items-center gap-4 py-3">
                <Thumb url={work.url} caption={work.caption} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {work.hide_price ? "Price hidden" : formatPrice(work.price, work.price_currency)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {work.hide_available && <Badge muted>Hidden</Badge>}
                  {work.hide_price && <Badge muted>Price hidden</Badge>}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[240px]">
                  <ActionBtn onClick={() => toggleHide(work.id, work.hide_available)} disabled={busy === work.id}>
                    {work.hide_available ? "Show" : "Hide"}
                  </ActionBtn>
                  {divider}
                  <ActionBtn onClick={() => togglePrice(work.id, work.hide_price)} disabled={busy === work.id}>
                    {work.hide_price ? "Show price" : "Hide price"}
                  </ActionBtn>
                  {divider}
                  <ActionBtn onClick={() => handleUnlist(work.id)} disabled={busy === work.id}>
                    Remove from profile
                  </ActionBtn>
                  {divider}
                  <ActionBtn onClick={() => handleDeleteAvailable(work.id)} disabled={busy === work.id} destructive>
                    Delete
                  </ActionBtn>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Sold ── */}
      {section === "sold" && (
        sold.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No transferred works yet.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {sold.map(work => (
              <div key={work.id} className={`flex items-center gap-4 py-3 ${work.hidden_from_artist ? "opacity-50" : ""}`}>
                <Thumb url={work.url} caption={work.caption} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{work.caption ?? "Untitled"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(work.created_at).toLocaleDateString("en-NZ", { year: "numeric", month: "short" })}
                    {work.price ? ` · ${formatPrice(work.price, work.price_currency)}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {work.hidden_from_artist
                    ? <Badge muted>Hidden from your profile</Badge>
                    : <Badge muted>Transferred</Badge>}
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[220px]">
                  {!work.hidden_from_artist && (
                    <>
                      <ActionBtn onClick={() => handleRemoveFromProfile(work.id)} disabled={busy === work.id}>
                        Remove from profile
                      </ActionBtn>
                      {divider}
                    </>
                  )}
                  <ActionBtn onClick={() => handleRequestDeletion(work.id)} disabled={busy === work.id} destructive>
                    Request deletion
                  </ActionBtn>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Thumb({ url, caption, type }: { url: string; caption: string | null; type?: string }) {
  return (
    <div className="w-12 h-12 shrink-0 overflow-hidden bg-muted border border-border">
      {(!type || type === "image") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={caption ?? ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{type}</span>
        </div>
      )}
    </div>
  );
}

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 leading-none border ${muted ? "border-border text-muted-foreground" : "border-black font-medium"}`}>
      {children}
    </span>
  );
}
