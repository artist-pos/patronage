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

function fmtDate(s: string | null) {
  if (!s) return null;
  return new Date(s).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
}

export function LiveStorefrontClient({ campaign, profile, heroImageUrl, works, cfg, highlightWorkId }: Props) {
  const [selectedWork, setSelectedWork] = useState<Work | null>(
    highlightWorkId ? (works.find(w => w.id === highlightWorkId) ?? null) : null
  );
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySent, setEnquirySent] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const scanLogged = useRef(false);

  const artistName = profile.full_name ?? profile.username;
  const statement = cfg.artist_statement ?? profile.bio ?? "";

  // Log QR scan once on mount
  useEffect(() => {
    if (scanLogged.current) return;
    scanLogged.current = true;
    fetch("/api/log-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "scan",
        campaign_id: campaign.id,
        work_id: highlightWorkId ?? null,
      }),
    }).catch(() => {});
  }, [campaign.id, highlightWorkId]);

  function handleWorkClick(work: Work) {
    setSelectedWork(prev => prev?.id === work.id ? null : work);
    fetch("/api/log-engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: "work_click", campaign_id: campaign.id, work_id: work.id }),
    }).catch(() => {});
  }

  async function handleEnquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!enquiryName.trim() || !enquiryEmail.trim()) return;
    setEnquirySending(true);
    setEnquiryError(null);
    const result = await sendCampaignEnquiry({
      campaignId: campaign.id,
      visitorName: enquiryName.trim(),
      visitorEmail: enquiryEmail.trim(),
      message: enquiryMessage.trim(),
      workTitle: selectedWork?.caption ?? selectedWork?.title ?? null,
    });
    setEnquirySending(false);
    if (result.error) {
      setEnquiryError(result.error);
    } else {
      setEnquirySent(true);
      fetch("/api/log-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: "enquiry", campaign_id: campaign.id }),
      }).catch(() => {});
    }
  }

  const startDate = fmtDate(campaign.campaign_start_date);
  const endDate = fmtDate(campaign.campaign_end_date);
  const dateRange = startDate && endDate
    ? `${startDate} – ${endDate}`
    : startDate ?? endDate ?? null;

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Hero */}
      {heroImageUrl && (
        <div className="w-full" style={{ maxHeight: "60vh", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImageUrl}
            alt={campaign.title}
            className="w-full object-cover"
            style={{ maxHeight: "60vh" }}
          />
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">

        {/* Artist + campaign header */}
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            {profile.avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={artistName}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{artistName}</p>
              <p className="text-xs text-muted-foreground">@{profile.username}</p>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="capitalize">{campaign.campaign_type.replace(/_/g, " ")}</span>
              {campaign.partner_name && <span>· {campaign.partner_name}</span>}
              {dateRange && <span>· {dateRange}</span>}
              {campaign.location_address && <span>· {campaign.location_address}</span>}
            </div>
          </div>
        </header>

        {/* Artist statement */}
        {statement && (
          <section>
            <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400 mb-3">
              Artist Statement
            </p>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{statement}</p>
          </section>
        )}

        {/* Works grid */}
        {works.length > 0 && (
          <section className="space-y-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">Works</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {works.map(work => {
                const isImage = !work.content_type || work.content_type === "image";
                const label = work.caption ?? work.title ?? "Untitled";
                const isHighlighted = selectedWork?.id === work.id || work.id === highlightWorkId;
                return (
                  <button
                    key={work.id}
                    type="button"
                    onClick={() => handleWorkClick(work)}
                    className={`text-left space-y-1 border-2 transition-colors ${isHighlighted ? "border-black" : "border-transparent hover:border-stone-200"}`}
                  >
                    {isImage && work.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={work.url} alt={label} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-stone-100 flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground uppercase">{work.content_type ?? "work"}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground truncate px-0.5">{label}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Selected work detail */}
        {selectedWork && (
          <section className="border border-black p-5 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-sm font-medium">
                {selectedWork.caption ?? selectedWork.title ?? "Untitled"}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedWork(null)}
                className="text-[11px] text-muted-foreground hover:text-foreground shrink-0"
              >
                Close
              </button>
            </div>

            {/* Commerce info */}
            <div className="space-y-1.5 text-sm">
              {cfg.original_available && (
                <div>
                  <span className="font-medium">Original — </span>
                  {cfg.is_poa
                    ? <span>Price on application</span>
                    : cfg.original_price != null
                      ? <span>NZD {cfg.original_price.toLocaleString()}</span>
                      : <span>Price on application</span>
                  }
                </div>
              )}
              {cfg.prints_available && cfg.print_sizes && cfg.print_sizes.length > 0 && (
                <div className="space-y-1">
                  <p className="font-medium">Prints available:</p>
                  <ul className="space-y-0.5 text-muted-foreground text-xs">
                    {cfg.print_sizes.filter(r => r.size).map((row, i) => (
                      <li key={i}>{row.size}{row.price ? ` — ${row.price}` : ""}</li>
                    ))}
                  </ul>
                  {cfg.paper_stock && (
                    <p className="text-xs text-muted-foreground">{cfg.paper_stock}</p>
                  )}
                  {cfg.edition_size && (
                    <p className="text-xs text-muted-foreground">Edition of {cfg.edition_size}</p>
                  )}
                </div>
              )}
              {!cfg.original_available && !cfg.prints_available && (
                <p className="text-muted-foreground text-xs">Enquire below for details.</p>
              )}
            </div>
          </section>
        )}

        {/* Enquiry form */}
        <section className="space-y-5 border-t border-border pt-10">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-widest text-stone-400">Get in touch</p>
            <p className="text-sm text-muted-foreground">
              {selectedWork
                ? `Enquire about "${selectedWork.caption ?? selectedWork.title ?? "this work"}"`
                : "Send an enquiry to the artist"}
            </p>
          </div>

          {enquirySent ? (
            <div className="border border-black p-5 space-y-2">
              <p className="text-sm font-medium">Enquiry sent!</p>
              <p className="text-xs text-muted-foreground">
                The artist will be in touch at {enquiryEmail}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleEnquiry} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label htmlFor="enquiry-name" className="text-xs font-medium">Your name</label>
                <input
                  id="enquiry-name"
                  type="text"
                  value={enquiryName}
                  onChange={e => setEnquiryName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="enquiry-email" className="text-xs font-medium">Email address</label>
                <input
                  id="enquiry-email"
                  type="email"
                  value={enquiryEmail}
                  onChange={e => setEnquiryEmail(e.target.value)}
                  required
                  placeholder="jane@example.com"
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="enquiry-message" className="text-xs font-medium">Message <span className="text-muted-foreground font-normal">(optional)</span></label>
                <textarea
                  id="enquiry-message"
                  value={enquiryMessage}
                  onChange={e => setEnquiryMessage(e.target.value)}
                  rows={3}
                  placeholder="I'm interested in…"
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground resize-none"
                />
              </div>
              {enquiryError && (
                <p className="text-xs text-red-600">{enquiryError}</p>
              )}
              <button
                type="submit"
                disabled={enquirySending || !enquiryName.trim() || !enquiryEmail.trim()}
                className="border border-black bg-black text-white text-sm px-6 py-2.5 hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enquirySending ? "Sending…" : "Send enquiry"}
              </button>
            </form>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border pt-8 text-center space-y-1">
          <p className="text-[11px] text-muted-foreground">
            Powered by{" "}
            <a href="https://patronage.nz" className="underline underline-offset-2 hover:text-foreground">
              Patronage
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
