"use client";

import { useState, useEffect, useRef } from "react";
import { sendCampaignEnquiry } from "./actions";

interface Work {
  id: string;
  url: string | null;
  caption: string | null;
  title: string | null;
  content_type?: string | null;
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

export function LiveStorefrontClient({
  campaign,
  profile,
  heroImageUrl,
  works,
  cfg,
  highlightWorkId,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showPrints, setShowPrints] = useState(false);
  const [activeWork, setActiveWork] = useState<Work | null>(
    highlightWorkId ? (works.find(w => w.id === highlightWorkId) ?? null) : null
  );
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [enquirySubject, setEnquirySubject] = useState<string | null>(null);
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySent, setEnquirySent] = useState(false);

  const scanLogged = useRef(false);

  const artistName = profile.full_name ?? profile.username;
  const heroWork = works[0] ?? null;
  const otherWorks = works.slice(1);
  const statement = cfg.artist_statement ?? "";
  const dateRange = fmtDateRange(campaign.campaign_start_date, campaign.campaign_end_date);
  const typeLabel = CAMPAIGN_TYPE_LABEL[campaign.campaign_type] ?? "Campaign";

  const hasOriginal = cfg.original_available;
  const hasPrints = cfg.prints_available && cfg.print_sizes?.some(r => r.size);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    return () => clearTimeout(t);
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
    setShowOriginal(false);
    setShowPrints(false);
  }

  function toggleOriginal() {
    if (!showOriginal) setShowPrints(false);
    setShowOriginal(v => !v);
  }

  function togglePrints() {
    if (!showPrints) setShowOriginal(false);
    setShowPrints(v => !v);
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

  const fade = (delay: string) =>
    `transition-all duration-700 ${delay} ${loaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`;

  return (
    <div className="min-h-screen bg-[#FAFAF9] max-w-[430px] mx-auto relative">

      {/* ── Context bar ─────────────────────────────────────────────────── */}
      <div className={`sticky top-0 z-50 bg-[#FAFAF9]/90 backdrop-blur-sm border-b border-border px-5 py-2.5 flex items-center justify-between ${fade("delay-0")}`}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {typeLabel}{campaign.location_address ? ` · ${campaign.location_address}` : ""}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground tracking-wide">patronage.nz</span>
      </div>

      {/* ── Hero image ──────────────────────────────────────────────────── */}
      <div className={fade("delay-100")}>
        <div className="w-full bg-stone-100 relative overflow-hidden" style={{ aspectRatio: "4/3" }}>
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt={heroWork?.caption ?? heroWork?.title ?? campaign.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-[11px] uppercase tracking-widest text-stone-300">No image</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Artwork info ────────────────────────────────────────────────── */}
      <div className={`px-6 pt-6 pb-0 space-y-4 ${fade("delay-200")}`}>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-normal leading-tight text-foreground" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontStyle: "italic" }}>
            {heroWork?.caption ?? heroWork?.title ?? campaign.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {[dateRange, campaign.partner_name].filter(Boolean).join(" · ")}
          </p>
        </div>

        {/* Commerce buttons */}
        {(hasOriginal || hasPrints) && (
          <div className="flex gap-3">
            {hasOriginal && (
              <button
                onClick={toggleOriginal}
                className={`flex-1 py-3 px-4 text-sm font-medium border transition-colors rounded-lg ${
                  showOriginal
                    ? "bg-black text-white border-black"
                    : "bg-transparent text-foreground border-border hover:border-black"
                }`}
              >
                {cfg.is_poa
                  ? "Original · POA"
                  : cfg.original_price != null
                    ? `Original · $${cfg.original_price.toLocaleString()}`
                    : "Original"}
              </button>
            )}
            {hasPrints && (
              <button
                onClick={togglePrints}
                className={`flex-1 py-3 px-4 text-sm font-medium border transition-colors rounded-lg ${
                  showPrints
                    ? "bg-black text-white border-black"
                    : "bg-transparent text-foreground border-border hover:border-black"
                }`}
              >
                Prints{cfg.print_sizes?.find(r => r.size && r.price) ? ` from ${cfg.print_sizes.find(r => r.size && r.price)!.price}` : ""}
              </button>
            )}
          </div>
        )}

        {/* Expanded: original */}
        {showOriginal && (
          <div className="border border-border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Original work. Comes with a Patronage provenance record — full ownership history and artist verification.
            </p>
            <button
              onClick={() => openEnquiry(`Enquiry about original: ${heroWork?.caption ?? heroWork?.title ?? campaign.title}`)}
              className="w-full py-3 bg-black text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors"
            >
              {cfg.is_poa
                ? "Enquire about price →"
                : `Express interest — $${cfg.original_price?.toLocaleString() ?? "POA"}`}
            </button>
            <p className="text-[10px] text-muted-foreground text-center">Artist will respond directly · No obligation</p>
          </div>
        )}

        {/* Expanded: prints */}
        {showPrints && cfg.print_sizes && (
          <div className="border border-border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {(cfg.paper_stock || cfg.edition_size) && (
              <p className="text-xs text-muted-foreground">
                {[cfg.paper_stock, cfg.edition_size ? `Edition of ${cfg.edition_size}` : null].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="divide-y divide-border">
              {cfg.print_sizes.filter(r => r.size).map((row, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <span className="text-sm">{row.size}</span>
                  <button
                    onClick={() => openEnquiry(`Print enquiry: ${row.size}${row.price ? ` — ${row.price}` : ""}`)}
                    className="text-xs border border-border px-4 py-1.5 rounded-lg hover:border-black transition-colors"
                  >
                    {row.price || "Enquire"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Artist statement */}
        {statement && (
          <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-border pl-4">
            {statement}
          </p>
        )}

        {/* Enquire link when no commerce */}
        {!hasOriginal && !hasPrints && (
          <button
            onClick={() => openEnquiry("General enquiry")}
            className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            Get in touch →
          </button>
        )}
      </div>

      {/* ── Enquiry form ─────────────────────────────────────────────────── */}
      {showEnquiryForm && (
        <div className="mx-6 mt-4 border border-border rounded-lg p-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {enquirySent ? (
            <div className="py-3 space-y-1">
              <p className="text-sm font-medium">Enquiry sent.</p>
              <p className="text-xs text-muted-foreground">The artist will be in touch at {enquiryEmail}.</p>
            </div>
          ) : (
            <form onSubmit={handleEnquirySubmit} className="space-y-3">
              {enquirySubject && (
                <p className="text-[11px] text-muted-foreground">{enquirySubject}</p>
              )}
              <input
                type="text"
                value={enquiryName}
                onChange={e => setEnquiryName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-black rounded-lg placeholder:text-muted-foreground bg-transparent"
              />
              <input
                type="email"
                value={enquiryEmail}
                onChange={e => setEnquiryEmail(e.target.value)}
                required
                placeholder="Email address"
                className="w-full border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-black rounded-lg placeholder:text-muted-foreground bg-transparent"
              />
              <textarea
                value={enquiryMessage}
                onChange={e => setEnquiryMessage(e.target.value)}
                rows={3}
                placeholder="Message (optional)"
                className="w-full border border-border px-3 py-2.5 text-sm focus:outline-none focus:border-black rounded-lg placeholder:text-muted-foreground resize-none bg-transparent"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={enquirySending || !enquiryName.trim() || !enquiryEmail.trim()}
                  className="flex-1 py-2.5 bg-black text-white text-sm font-medium rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-40"
                >
                  {enquirySending ? "Sending…" : "Send enquiry"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnquiryForm(false)}
                  className="px-4 py-2.5 border border-border text-sm text-muted-foreground rounded-lg hover:border-black hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="mx-6 mt-6 border-t border-border" />

      {/* ── Artist section ───────────────────────────────────────────────── */}
      <div className={`px-6 py-6 space-y-4 ${fade("delay-300")}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={artistName}
                className="w-11 h-11 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-stone-200 flex items-center justify-center text-sm font-semibold text-stone-600 shrink-0">
                {initials(artistName)}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{artistName}</p>
              <p className="text-[11px] text-muted-foreground">@{profile.username}</p>
            </div>
          </div>
          <a
            href={`/${profile.username}`}
            className="text-xs border border-border px-4 py-1.5 rounded-full hover:border-black transition-colors text-muted-foreground hover:text-foreground"
          >
            Follow
          </a>
        </div>

        {profile.bio && !statement && (
          <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
        )}
      </div>

      {/* ── More works ───────────────────────────────────────────────────── */}
      {otherWorks.length > 0 && (
        <>
          <div className="mx-6 border-t border-border" />
          <div className={`px-6 py-6 space-y-4 ${fade("delay-500")}`}>
            <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
              More by {artistName.split(" ")[0]}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {otherWorks.map(work => {
                const label = work.caption ?? work.title ?? "Untitled";
                const isImage = !work.content_type || work.content_type === "image";
                const isActive = activeWork?.id === work.id;
                return (
                  <button
                    key={work.id}
                    onClick={() => handleWorkClick(work)}
                    className={`text-left space-y-2 border-2 rounded-lg overflow-hidden transition-colors ${isActive ? "border-black" : "border-transparent hover:border-stone-200"}`}
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
                        {isActive ? "Tap to enquire" : "View"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active work enquire prompt */}
            {activeWork && (
              <div className="flex items-center justify-between gap-4 border border-border rounded-lg px-4 py-3 animate-in fade-in duration-200">
                <p className="text-sm truncate">{activeWork.caption ?? activeWork.title ?? "Untitled"}</p>
                <button
                  onClick={() => openEnquiry(`Enquiry: ${activeWork.caption ?? activeWork.title ?? "work"}`)}
                  className="text-xs bg-black text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors shrink-0"
                >
                  Enquire
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Full profile CTA ─────────────────────────────────────────────── */}
      <div className={`px-6 pb-6 ${fade("delay-700")}`}>
        <a
          href={`/${profile.username}`}
          className="block w-full text-center py-3.5 border border-border rounded-lg text-sm text-muted-foreground hover:border-black hover:text-foreground transition-colors"
        >
          View full profile on Patronage →
        </a>
      </div>

      {/* ── Footer credit ────────────────────────────────────────────────── */}
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
}
