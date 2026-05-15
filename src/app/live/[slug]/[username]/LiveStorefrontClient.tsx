"use client";

import { useState, useEffect, useRef } from "react";
import { sendCampaignEnquiry, createCampaignSaleCheckout, claimCampaignWorkFree } from "./actions";

interface Work {
  id: string;
  url: string | null;
  caption: string | null;
  title: string | null;
  content_type?: string | null;
  slug?: string | null;
}

interface WorkPricing {
  available?: boolean;
  price?: number | null;
  is_poa?: boolean;
  acquisition_mode?: "buy_now" | "enquire_first";
  prints_available?: boolean;
  print_sizes?: Array<{ size: string; price: string }>;
}

interface Props {
  campaign: {
    id: string;
    title: string;
    slug: string;
    campaign_type: string;
    partner_name: string | null;
    campaign_start_date: string | null;
    campaign_end_date: string | null;
    location_address: string | null;
  };
  profile: {
    id: string;
    full_name: string | null;
    username: string;
    bio: string | null;
    avatar_url: string | null;
  };
  heroImageUrl: string | null;
  works: Work[];
  cfg: {
    layout_mode?: "shopfront" | "showcase";
    work_pricing?: Record<string, WorkPricing>;
    original_available?: boolean;
    original_price?: number | null;
    is_poa?: boolean;
    prints_available?: boolean;
    print_sizes?: Array<{ size: string; price: string }>;
    edition_size?: string;
    paper_stock?: string;
    artist_statement?: string;
  };
  highlightWorkId: string | null;
  artistEmail: null;
  artistId: string;
}

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  exhibition: "Exhibition",
  art_fair: "Art fair",
  market_stall: "Market stall",
  pop_up: "Pop-up",
  custom_live: "Live experience",
  other: "Campaign",
};

function fmtDateRange(start: string | null, end: string | null) {
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("en-NZ", { month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function PriceDisplay({ wp, fallback }: { wp: WorkPricing | null | undefined; fallback?: { available?: boolean; price?: number | null; is_poa?: boolean } }) {
  const resolved = wp ?? fallback;
  if (!resolved?.available) return null;
  if (resolved.is_poa) return <span className="text-sm font-medium">Price on application</span>;
  if (resolved.price != null) return <span className="text-sm font-medium">${resolved.price.toLocaleString()}</span>;
  return <span className="text-sm font-medium">Price on application</span>;
}

export function LiveStorefrontClient({
  campaign,
  profile,
  heroImageUrl,
  works,
  cfg,
  highlightWorkId,
  artistId,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  // Show success message if buyer was redirected back after Stripe checkout
  const [purchased, setPurchased] = useState(false);
  const [activeWork, setActiveWork] = useState<Work | null>(
    highlightWorkId ? (works.find(w => w.id === highlightWorkId) ?? null) : null
  );
  const [showOriginalPanel, setShowOriginalPanel] = useState(false);
  const [showPrintsPanel, setShowPrintsPanel] = useState(false);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [enquirySubject, setEnquirySubject] = useState<string | null>(null);
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySent, setEnquirySent] = useState(false);
  const [purchaseName, setPurchaseName] = useState("");
  const [purchaseEmail, setPurchaseEmail] = useState("");
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseDone, setPurchaseDone] = useState(false);
  const scanLogged = useRef(false);

  const artistName = profile.full_name ?? profile.username;
  const heroWork = works[0] ?? null;
  const otherWorks = works.slice(1);
  const statement = cfg.artist_statement ?? "";
  const dateRange = fmtDateRange(campaign.campaign_start_date, campaign.campaign_end_date);
  const typeLabel = CAMPAIGN_TYPE_LABEL[campaign.campaign_type] ?? "Campaign";

  // When a specific work is highlighted (per-work QR), always use showcase layout
  const layoutMode = highlightWorkId ? "showcase" : (cfg.layout_mode ?? "shopfront");

  // What image to show in the left panel (desktop: switches to active work)
  const displayWork = activeWork ?? heroWork;
  const displayImageUrl = (displayWork?.content_type === "image" || !displayWork?.content_type)
    ? (displayWork?.url ?? heroImageUrl)
    : heroImageUrl;
  const displayLabel = displayWork?.caption ?? displayWork?.title ?? campaign.title;

  // Global pricing fallback
  const globalPricing: WorkPricing = { available: cfg.original_available, price: cfg.original_price, is_poa: cfg.is_poa, acquisition_mode: undefined, prints_available: cfg.prints_available, print_sizes: cfg.print_sizes };
  const globalHasPrints = cfg.prints_available && cfg.print_sizes?.some(r => r.size);

  // Per-work pricing for the active/display work
  const displayWorkPricing = cfg.work_pricing?.[displayWork?.id ?? ""] ?? null;
  const activePricing = activeWork ? (cfg.work_pricing?.[activeWork.id] ?? null) : null;

  // Resolved pricing for the current display context
  const resolvedPricing = displayWorkPricing ?? globalPricing;
  const hasPrints = (displayWorkPricing?.prints_available && displayWorkPricing.print_sizes?.some(r => r.size))
    || (!displayWorkPricing && globalHasPrints);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("purchased") === "1") {
      setPurchased(true);
    }
  }, []);

  useEffect(() => {
    if (scanLogged.current) return;
    scanLogged.current = true;
    fetch("/api/log-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "scan", campaign_id: campaign.id, work_id: highlightWorkId ?? null }),
    }).catch(() => {});
  }, [campaign.id, highlightWorkId]);

  function handleWorkClick(work: Work) {
    setActiveWork(prev => prev?.id === work.id ? null : work);
    setShowOriginalPanel(false);
    setShowPrintsPanel(false);
    setShowEnquiryForm(false);
    fetch("/api/log-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "work_click", campaign_id: campaign.id, work_id: work.id }),
    }).catch(() => {});
  }

  function openEnquiry(subject: string) {
    setEnquirySubject(subject);
    setShowEnquiryForm(true);
    setEnquirySent(false);
    setShowOriginalPanel(false);
    setShowPrintsPanel(false);
  }

  function toggleOriginalPanel() {
    if (!showOriginalPanel) setShowPrintsPanel(false);
    setShowOriginalPanel(v => !v);
    setShowEnquiryForm(false);
  }

  function togglePrintsPanel() {
    if (!showPrintsPanel) setShowOriginalPanel(false);
    setShowPrintsPanel(v => !v);
    setShowEnquiryForm(false);
  }

  async function handleEnquirySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!enquiryName.trim() || !enquiryEmail.trim()) return;
    setEnquirySending(true);
    const result = await sendCampaignEnquiry({
      campaignId: campaign.id,
      visitorName: enquiryName.trim(),
      visitorEmail: enquiryEmail.trim(),
      message: enquiryMessage.trim() || (enquirySubject ?? ""),
      workTitle: activeWork?.caption ?? activeWork?.title ?? null,
    });
    setEnquirySending(false);
    if (!result.error) {
      setEnquirySent(true);
      fetch("/api/log-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "enquiry", campaign_id: campaign.id }),
      }).catch(() => {});
    }
  }

  async function handlePurchaseSubmit(
    e: React.FormEvent,
    workId: string,
    priceCents: number,
    isFree: boolean,
  ) {
    e.preventDefault();
    if (!purchaseName.trim() || !purchaseEmail.trim()) return;
    setPurchaseSubmitting(true);
    setPurchaseError(null);

    if (isFree) {
      const result = await claimCampaignWorkFree({
        campaignId: campaign.id,
        workId,
        artistId,
        claimerName: purchaseName.trim(),
        claimerEmail: purchaseEmail.trim(),
      });
      setPurchaseSubmitting(false);
      if (result.error) { setPurchaseError(result.error); return; }
      setPurchaseDone(true);
    } else {
      const displayWork2 = works.find(w => w.id === workId) ?? works[0];
      const result = await createCampaignSaleCheckout({
        campaignId: campaign.id,
        workId,
        artistId,
        campaignSlug: campaign.slug,
        artistUsername: profile.username,
        buyerName: purchaseName.trim(),
        buyerEmail: purchaseEmail.trim(),
        priceCents,
        currency: "NZD",
        workTitle: displayWork2?.caption ?? displayWork2?.title ?? campaign.title,
        workImageUrl: displayWork2?.url ?? null,
      });
      setPurchaseSubmitting(false);
      if (result.error) { setPurchaseError(result.error); return; }
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
    }
  }

  const fade = (delay: string) =>
    `transition-all duration-700 ${delay} ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`;

  // ── Enquiry form ───────────────────────────────────────────────────────────
  const EnquiryForm = (
    <div className="border border-border p-5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
      {enquirySent ? (
        <div className="py-2 space-y-1">
          <p className="text-sm font-medium">Enquiry sent.</p>
          <p className="text-xs text-muted-foreground">The artist will be in touch at {enquiryEmail}.</p>
        </div>
      ) : (
        <form onSubmit={handleEnquirySubmit} className="space-y-3">
          {enquirySubject && <p className="text-[11px] text-muted-foreground">{enquirySubject}</p>}
          <input type="text" value={enquiryName} onChange={e => setEnquiryName(e.target.value)} required placeholder="Your name"
            className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground bg-[#FAFAF9]" />
          <input type="email" value={enquiryEmail} onChange={e => setEnquiryEmail(e.target.value)} required placeholder="Email address"
            className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground bg-[#FAFAF9]" />
          <textarea value={enquiryMessage} onChange={e => setEnquiryMessage(e.target.value)} rows={3} placeholder="Message (optional)"
            className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground resize-none bg-[#FAFAF9]" />
          <div className="flex gap-2">
            <button type="submit" disabled={enquirySending || !enquiryName.trim() || !enquiryEmail.trim()}
              className="flex-1 py-2.5 bg-black text-white text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-40">
              {enquirySending ? "Sending…" : "Send enquiry"}
            </button>
            <button type="button" onClick={() => setShowEnquiryForm(false)}
              className="px-4 py-2.5 border border-border text-sm text-muted-foreground hover:border-black hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );

  // ── Content column (shared mobile + desktop right panel) ───────────────────
  const ContentColumn = (
    <div className="space-y-0">

      {/* Post-checkout success banner */}
      {purchased && (
        <div className="mx-6 mt-6 border border-border p-4 space-y-1 animate-in fade-in duration-300">
          <p className="text-sm font-medium">Purchase confirmed.</p>
          <p className="text-xs text-muted-foreground">Your certificate of provenance is on its way. Check your email to claim your account.</p>
        </div>
      )}

      {/* Artwork title + meta */}
      <div className={`px-6 pt-7 pb-6 space-y-3 ${fade("delay-100")}`}>
        <h1 className="text-2xl font-normal leading-tight" style={{ fontFamily: "'Georgia','Times New Roman',serif", fontStyle: "italic" }}>
          {displayLabel}
        </h1>
        <p className="text-xs text-muted-foreground">
          {[typeLabel, dateRange, campaign.partner_name ? `Supported by ${campaign.partner_name}` : null]
            .filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Commerce — resolves per-work pricing, falls back to global */}
      {(() => {
        const hasOriginal = resolvedPricing?.available;
        const printSizes = displayWorkPricing?.prints_available
          ? (displayWorkPricing.print_sizes ?? [])
          : (cfg.print_sizes ?? []);
        const lowestPrint = printSizes.find(r => r.size && r.price);
        return (hasOriginal || hasPrints) ? (
          <div className={`px-6 pb-6 space-y-3 ${fade("delay-150")}`}>
            <div className="flex gap-3">
              {hasOriginal && (
                <button onClick={toggleOriginalPanel}
                  className={`flex-1 py-3 px-4 text-sm font-medium border transition-colors ${showOriginalPanel ? "bg-black text-white border-black" : "border-border hover:border-black"}`}>
                  {resolvedPricing.is_poa
                    ? "Original · POA"
                    : resolvedPricing.price != null && resolvedPricing.price > 0
                      ? resolvedPricing.acquisition_mode === "buy_now"
                        ? `Buy now · $${resolvedPricing.price.toLocaleString()}`
                        : `Original · $${resolvedPricing.price.toLocaleString()}`
                      : "Enquire about original"}
                </button>
              )}
              {hasPrints && (
                <button onClick={togglePrintsPanel}
                  className={`flex-1 py-3 px-4 text-sm font-medium border transition-colors ${showPrintsPanel ? "bg-black text-white border-black" : "border-border hover:border-black"}`}>
                  Prints{lowestPrint ? ` from ${lowestPrint.price}` : ""}
                </button>
              )}
            </div>

            {showOriginalPanel && (() => {
              const isFree = !resolvedPricing.is_poa && resolvedPricing.price === 0;
              const hasPrice = !resolvedPricing.is_poa && resolvedPricing.price != null && resolvedPricing.price > 0;
              const acquisitionMode = resolvedPricing.acquisition_mode ?? "enquire_first";
              const isBuyNow = acquisitionMode === "buy_now" && hasPrice;
              const priceCents = Math.round((resolvedPricing.price ?? 0) * 100);
              const currentWorkId = displayWork?.id ?? works[0]?.id ?? "";

              if (purchaseDone) {
                return (
                  <div className="border border-border p-4 space-y-1 animate-in fade-in duration-200">
                    <p className="text-sm font-medium">Done — check your inbox.</p>
                    <p className="text-xs text-muted-foreground">Your certificate of provenance is on its way to {purchaseEmail}.</p>
                  </div>
                );
              }

              if (isFree || isBuyNow) {
                return (
                  <div className="border border-border p-4 space-y-3 animate-in fade-in duration-200">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {isFree
                        ? "Claim this work for free. You'll receive a Patronage provenance certificate by email."
                        : "Purchase includes a Patronage provenance certificate — full ownership history and artist verification."}
                    </p>
                    <form onSubmit={e => handlePurchaseSubmit(e, currentWorkId, priceCents, isFree)} className="space-y-2">
                      <input type="text" value={purchaseName} onChange={e => setPurchaseName(e.target.value)} required placeholder="Your name"
                        className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground bg-[#FAFAF9]" />
                      <input type="email" value={purchaseEmail} onChange={e => setPurchaseEmail(e.target.value)} required placeholder="Email address"
                        className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground bg-[#FAFAF9]" />
                      {purchaseError && <p className="text-xs text-red-600">{purchaseError}</p>}
                      <button type="submit" disabled={purchaseSubmitting || !purchaseName.trim() || !purchaseEmail.trim()}
                        className="w-full py-3 bg-black text-white text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-40">
                        {purchaseSubmitting
                          ? (isFree ? "Claiming…" : "Redirecting to checkout…")
                          : isFree
                            ? "Claim for free →"
                            : `Buy now — $${resolvedPricing.price?.toLocaleString()} →`}
                      </button>
                    </form>
                    <p className="text-[10px] text-muted-foreground text-center">
                      {isFree ? "No payment required · You'll receive a certificate of provenance by email" : "Secure checkout via Stripe"}
                    </p>
                  </div>
                );
              }

              return (
                <div className="border border-border p-4 space-y-3 animate-in fade-in duration-200">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {hasPrice
                      ? `NZD ${resolvedPricing.price?.toLocaleString()} · get in touch to purchase.`
                      : "Original work. Comes with a Patronage provenance record — full ownership history and artist verification."}
                  </p>
                  <button onClick={() => openEnquiry(`Enquiry about original: ${displayLabel}`)}
                    className="w-full py-3 bg-black text-white text-sm font-medium hover:bg-stone-800 transition-colors">
                    {resolvedPricing.is_poa ? "Enquire about price →" : "Enquire →"}
                  </button>
                  <p className="text-[10px] text-muted-foreground text-center">Artist responds directly · No obligation</p>
                </div>
              );
            })()}

            {showPrintsPanel && printSizes.length > 0 && (
              <div className="border border-border p-4 space-y-3 animate-in fade-in duration-200">
                {(cfg.paper_stock || cfg.edition_size) && (
                  <p className="text-xs text-muted-foreground">
                    {[cfg.paper_stock, cfg.edition_size ? `Edition of ${cfg.edition_size}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="divide-y divide-border">
                  {printSizes.filter(r => r.size).map((row, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5">
                      <span className="text-sm">{row.size}</span>
                      <button onClick={() => openEnquiry(`Print enquiry: ${row.size}${row.price ? ` — ${row.price}` : ""}`)}
                        className="text-xs border border-border px-4 py-1.5 hover:border-black transition-colors">
                        {row.price || "Enquire"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`px-6 pb-6 ${fade("delay-150")}`}>
            <button onClick={() => openEnquiry("General enquiry")}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors">
              Get in touch →
            </button>
          </div>
        );
      })()}

      {/* Enquiry form */}
      {showEnquiryForm && <div className="px-6 pb-6">{EnquiryForm}</div>}

      {/* Artist statement */}
      {statement && (
        <div className={`px-6 pb-6 ${fade("delay-200")}`}>
          <p className="text-sm text-muted-foreground leading-relaxed">{statement}</p>
        </div>
      )}

      <div className={`border-t border-border ${statement ? "mx-0" : "mx-6"}`} />

      {/* Artist section */}
      <div className={`px-6 py-6 ${fade("delay-300")}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={artistName} className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-stone-200 flex items-center justify-center text-xs font-semibold text-stone-600 shrink-0">
                {initials(artistName)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{artistName}</p>
              <p className="text-[11px] text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <a href={`/${profile.username}`}
            className="text-xs border border-border px-4 py-1.5 rounded-full hover:border-black transition-colors text-muted-foreground hover:text-foreground">
            View profile →
          </a>
        </div>
        {profile.bio && !statement && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-4">{profile.bio}</p>
        )}
      </div>

      {/* Works section */}
      {works.length > 0 && (
        <>
          <div className="mx-6 border-t border-border" />
          <div className={`px-6 pt-8 pb-6 space-y-4 ${fade("delay-400")}`}>
            {layoutMode === "shopfront" ? (
              // Shopfront: grid of all works up front
              <>
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Works</p>
                <div className="grid grid-cols-2 gap-3">
                  {works.map(work => <WorkTile key={work.id} work={work} isActive={activeWork?.id === work.id} pricing={cfg.work_pricing?.[work.id]} fallbackPricing={globalPricing} onClick={() => handleWorkClick(work)} />)}
                </div>
              </>
            ) : (
              // Showcase: hero is implicit (shown left), other works below
              otherWorks.length > 0 && (
                <>
                  <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                    More by {artistName.split(" ")[0]}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {otherWorks.map(work => <WorkTile key={work.id} work={work} isActive={activeWork?.id === work.id} pricing={cfg.work_pricing?.[work.id]} fallbackPricing={globalPricing} onClick={() => handleWorkClick(work)} />)}
                  </div>
                </>
              )
            )}

            {/* Active work detail + enquiry prompt */}
            {activeWork && (
              <div className="border border-border p-4 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{activeWork.caption ?? activeWork.title ?? "Untitled"}</p>
                    {activePricing?.available ? (
                      <PriceDisplay wp={activePricing} />
                    ) : (
                      <PriceDisplay wp={null} fallback={globalPricing} />
                    )}
                  </div>
                  <button onClick={() => setActiveWork(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground shrink-0">
                    Close
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEnquiry(`Enquiry about: ${activeWork.caption ?? activeWork.title ?? "work"}`)}
                    className="flex-1 py-2.5 bg-black text-white text-sm font-medium hover:bg-stone-800 transition-colors">
                    Enquire →
                  </button>
                  <a
                    href={`/${profile.username}/works/${activeWork.slug ?? activeWork.id}`}
                    className="px-4 py-2.5 border border-border text-xs text-muted-foreground hover:border-black hover:text-foreground transition-colors flex items-center"
                  >
                    View →
                  </a>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Profile CTA */}
      <div className={`px-6 pb-6 ${fade("delay-500")}`}>
        <a href={`/${profile.username}`}
          className="block w-full text-center py-3.5 border border-border text-sm text-muted-foreground hover:border-black hover:text-foreground transition-colors">
          View full profile on Patronage →
        </a>
      </div>

      {/* Footer credit */}
      {campaign.partner_name && (
        <div className="px-6 py-5 border-t border-border flex items-end justify-between">
          <div className="space-y-0.5">
            <p className="text-[9px] uppercase tracking-widest text-stone-400">Supported by</p>
            <p className="text-xs text-muted-foreground">
              {campaign.partner_name}{dateRange ? ` · ${dateRange}` : ""}
            </p>
          </div>
          <p className="text-[10px] text-stone-300 tracking-wide">patronage.nz</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAF9] max-w-[1600px] mx-auto">

      {/* ── Context bar — full width, sticky ────────────────────────────── */}
      <div className={`sticky top-0 z-50 bg-[#FAFAF9]/90 backdrop-blur-sm border-b border-border px-5 py-2.5 flex items-center justify-between ${fade("delay-0")}`}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {typeLabel}{campaign.location_address ? ` · ${campaign.location_address}` : ""}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tracking-wide">patronage.nz</span>
      </div>

      {/* ── Mobile layout ────────────────────────────────────────────────── */}
      <div className="lg:hidden">
        {/* Hero image */}
        <div className={`w-full bg-stone-100 overflow-hidden ${fade("delay-100")}`} style={{ aspectRatio: "4/3" }}>
          {displayImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImageUrl} alt={displayLabel} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[11px] uppercase tracking-widest text-stone-300">No image</span>
            </div>
          )}
        </div>
        {ContentColumn}
      </div>

      {/* ── Desktop layout (lg+) ─────────────────────────────────────────── */}
      <div className="hidden lg:flex" style={{ height: "calc(100vh - 44px)" }}>

        {/* Left: sticky image panel — contain so natural aspect ratio is preserved */}
        <div className="flex-1 relative overflow-hidden bg-stone-50">
          {displayImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayImageUrl}
              alt={displayLabel}
              className="absolute inset-0 w-full h-full object-contain transition-opacity duration-500"
              key={displayImageUrl}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] uppercase tracking-widest text-stone-300">No image</span>
            </div>
          )}

          {/* Bottom caption overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-8 py-6 bg-gradient-to-t from-black/20 to-transparent">
            {activeWork && activeWork.id !== works[0]?.id && (
              <div className="space-y-0.5">
                <p className="text-white text-sm font-medium drop-shadow">
                  {activeWork.caption ?? activeWork.title ?? "Untitled"}
                </p>
                {activePricing?.available ? (
                  <p className="text-white/70 text-xs drop-shadow">
                    {activePricing.is_poa ? "POA" : activePricing.price != null ? `$${activePricing.price.toLocaleString()}` : ""}
                  </p>
                ) : globalPricing?.available ? (
                  <p className="text-white/70 text-xs drop-shadow">
                    {globalPricing.is_poa ? "POA" : globalPricing.price != null ? `$${globalPricing.price.toLocaleString()}` : ""}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Right: scrollable content panel — max 420px, 40px left padding */}
        <div className="w-[420px] shrink-0 overflow-y-auto border-l border-border">
          <div className="pl-4">
            {ContentColumn}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── WorkTile ─────────────────────────────────────────────────────────────────

function WorkTile({
  work,
  isActive,
  pricing,
  fallbackPricing,
  onClick,
}: {
  work: Work;
  isActive: boolean;
  pricing: WorkPricing | undefined;
  fallbackPricing: { available?: boolean; price?: number | null; is_poa?: boolean };
  onClick: () => void;
}) {
  const label = work.caption ?? work.title ?? "Untitled";
  const isImage = !work.content_type || work.content_type === "image";
  const resolved = pricing?.available ? pricing : (fallbackPricing?.available ? fallbackPricing : null);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left space-y-2 border-2 overflow-hidden transition-colors ${isActive ? "border-black" : "border-transparent hover:border-stone-200"}`}
    >
      <div className="w-full aspect-square bg-stone-100 overflow-hidden">
        {isImage && work.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={work.url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[9px] uppercase tracking-widest text-stone-400">{work.content_type ?? "work"}</span>
          </div>
        )}
      </div>
      <div className="px-1 pb-2 space-y-0.5">
        <p className="text-xs font-medium leading-snug truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground">
          {resolved
            ? resolved.is_poa
              ? "POA"
              : resolved.price != null
                ? `$${resolved.price.toLocaleString()}`
                : "Enquire"
            : "Enquire"}
        </p>
      </div>
    </button>
  );
}
