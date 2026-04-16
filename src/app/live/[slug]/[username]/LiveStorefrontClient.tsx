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

  // Enquiry form state
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySent, setEnquirySent] = useState(false);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [enquirySubject, setEnquirySubject] = useState<string | null>(null);

  const scanLogged = useRef(false);

  const artistName = profile.full_name ?? profile.username;
  const heroWork = works[0] ?? null;
  const otherWorks = works.slice(1);
  const statement = cfg.artist_statement ?? profile.bio ?? "";
  const dateRange = fmtDateRange(campaign.campaign_start_date, campaign.campaign_end_date);
  const typeLabel = CAMPAIGN_TYPE_LABEL[campaign.campaign_type] ?? "Campaign";
  const contextLabel = campaign.location_address
    ? `${campaign.location_address}`
    : typeLabel;

  const hasOriginal = cfg.original_available;
  const hasPrints = cfg.prints_available && cfg.print_sizes && cfg.print_sizes.some(r => r.size);
  const lowestPrint = cfg.print_sizes?.find(r => r.size && r.price)?.price ?? null;

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 100);
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
  }

  function toggleOriginal() {
    if (!showOriginal) { setShowPrints(false); }
    setShowOriginal(v => !v);
  }

  function togglePrints() {
    if (!showPrints) { setShowOriginal(false); }
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

  const s = {
    page: {
      minHeight: "100vh",
      background: "#0e0d0b",
      color: "#e8e4df",
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative" as const,
    },
    fadeIn: (delay: number) => ({
      opacity: loaded ? 1 : 0,
      transform: loaded ? "translateY(0)" : "translateY(16px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }),
  };

  return (
    <div style={s.page}>

      {/* ── Context bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(14,13,11,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...s.fadeIn(0),
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#d4a853", flexShrink: 0 }} />
          <span style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#888" }}>
            {typeLabel} · {contextLabel}
          </span>
        </div>
        <span style={{ fontSize: 10, color: "#d4a853", letterSpacing: "0.04em", fontWeight: 500 }}>
          patronage.nz
        </span>
      </div>

      {/* ── Hero image ──────────────────────────────────────────────────── */}
      <div style={s.fadeIn(0.2)}>
        <div style={{
          width: "100%",
          aspectRatio: "4/3",
          background: "#1a1917",
          position: "relative",
          overflow: "hidden",
        }}>
          {heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImageUrl}
              alt={heroWork?.caption ?? heroWork?.title ?? campaign.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                No image
              </span>
            </div>
          )}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 80,
            background: "linear-gradient(to top, rgba(14,13,11,0.6), transparent)",
          }} />
        </div>
      </div>

      {/* ── Artwork info + commerce ──────────────────────────────────────── */}
      <div style={{ padding: "24px 24px 0", ...s.fadeIn(0.4) }}>
        <h1 style={{
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 26,
          fontWeight: 400,
          lineHeight: 1.2,
          marginBottom: 6,
          fontStyle: "italic",
          color: "#f5f0eb",
        }}>
          {heroWork?.caption ?? heroWork?.title ?? campaign.title}
        </h1>

        <p style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>
          {[dateRange, campaign.partner_name ? `Supported by ${campaign.partner_name}` : null]
            .filter(Boolean).join(" · ")}
        </p>

        {/* Commerce buttons */}
        {(hasOriginal || hasPrints) && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {hasOriginal && (
              <button
                onClick={toggleOriginal}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: showOriginal ? "#d4a853" : "rgba(212,168,83,0.1)",
                  border: "1px solid rgba(212,168,83,0.3)",
                  borderRadius: 8,
                  color: showOriginal ? "#0e0d0b" : "#d4a853",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  fontFamily: "inherit",
                  textAlign: "left" as const,
                }}
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
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: showPrints ? "#e8e4df" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  color: showPrints ? "#0e0d0b" : "#e8e4df",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  fontFamily: "inherit",
                  textAlign: "left" as const,
                }}
              >
                Prints{lowestPrint ? ` from ${lowestPrint}` : ""}
              </button>
            )}
          </div>
        )}

        {/* Expanded: original */}
        {showOriginal && (
          <div style={{
            background: "rgba(212,168,83,0.06)",
            border: "1px solid rgba(212,168,83,0.15)",
            borderRadius: 10,
            padding: 18,
            marginBottom: 20,
            animation: "fadeUp 0.3s ease",
          }}>
            <p style={{ fontSize: 12, color: "#bbb", marginBottom: 14, lineHeight: 1.6 }}>
              Original work. Comes with a Patronage provenance record — full ownership history and artist verification.
            </p>
            <button
              onClick={() => openEnquiry(`Enquiry about original: ${heroWork?.caption ?? heroWork?.title ?? campaign.title}`)}
              style={{
                width: "100%",
                padding: 14,
                background: "#d4a853",
                border: "none",
                borderRadius: 8,
                color: "#0e0d0b",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                letterSpacing: "0.02em",
              }}
            >
              {cfg.is_poa ? "Enquire about price →" : `Express interest — ${cfg.original_price != null ? `$${cfg.original_price.toLocaleString()}` : "POA"}`}
            </button>
            <p style={{ fontSize: 10, color: "#777", textAlign: "center" as const, marginTop: 8 }}>
              Artist will respond directly · No obligation
            </p>
          </div>
        )}

        {/* Expanded: prints */}
        {showPrints && cfg.print_sizes && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: 18,
            marginBottom: 20,
            animation: "fadeUp 0.3s ease",
          }}>
            {(cfg.paper_stock || cfg.edition_size) && (
              <p style={{ fontSize: 12, color: "#bbb", marginBottom: 14, lineHeight: 1.6 }}>
                {cfg.paper_stock ? `${cfg.paper_stock}. ` : ""}
                {cfg.edition_size ? `Edition of ${cfg.edition_size}.` : ""}
              </p>
            )}
            {cfg.print_sizes.filter(r => r.size).map((row, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
                <span style={{ fontSize: 13, color: "#ddd" }}>{row.size}</span>
                <button
                  onClick={() => openEnquiry(`Print enquiry: ${row.size}${row.price ? ` — ${row.price}` : ""}`)}
                  style={{
                    padding: "8px 18px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    color: "#e8e4df",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {row.price || "Enquire"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Artist statement */}
        {statement && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.65, fontStyle: "italic" as const }}>
              "{statement}"
            </p>
          </div>
        )}
      </div>

      {/* ── Enquiry form ─────────────────────────────────────────────────── */}
      {showEnquiryForm && (
        <div style={{
          margin: "0 24px 20px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10,
          padding: 20,
          animation: "fadeUp 0.3s ease",
        }}>
          {enquirySent ? (
            <div style={{ textAlign: "center" as const, padding: "12px 0" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#d4a853", marginBottom: 6 }}>Sent!</p>
              <p style={{ fontSize: 12, color: "#888" }}>The artist will be in touch at {enquiryEmail}.</p>
            </div>
          ) : (
            <form onSubmit={handleEnquirySubmit} style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {enquirySubject && (
                <p style={{ fontSize: 11, color: "#888", letterSpacing: "0.04em" }}>{enquirySubject}</p>
              )}
              <input
                type="text"
                value={enquiryName}
                onChange={e => setEnquiryName(e.target.value)}
                required
                placeholder="Your name"
                style={inputStyle}
              />
              <input
                type="email"
                value={enquiryEmail}
                onChange={e => setEnquiryEmail(e.target.value)}
                required
                placeholder="Email address"
                style={inputStyle}
              />
              <textarea
                value={enquiryMessage}
                onChange={e => setEnquiryMessage(e.target.value)}
                rows={3}
                placeholder="Message (optional)"
                style={{ ...inputStyle, resize: "none" as const }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="submit"
                  disabled={enquirySending || !enquiryName.trim() || !enquiryEmail.trim()}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#d4a853",
                    border: "none",
                    borderRadius: 8,
                    color: "#0e0d0b",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity: (enquirySending || !enquiryName.trim() || !enquiryEmail.trim()) ? 0.4 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {enquirySending ? "Sending…" : "Send enquiry"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnquiryForm(false)}
                  style={{
                    padding: "12px 16px",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#888",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 24px" }} />

      {/* ── Artist section ───────────────────────────────────────────────── */}
      <div style={{ padding: "22px 24px", ...s.fadeIn(0.6) }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={artistName}
                style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #d4956b, #7a9ec4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                flexShrink: 0,
              }}>
                {initials(artistName)}
              </div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{artistName}</div>
              <div style={{ fontSize: 11, color: "#888" }}>@{profile.username}</div>
            </div>
          </div>
          <a
            href={`/${profile.username}`}
            style={{
              padding: "8px 18px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 20,
              color: "#ccc",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              textDecoration: "none",
              whiteSpace: "nowrap" as const,
            }}
          >
            Follow
          </a>
        </div>

        {profile.bio && !statement && (
          <p style={{ fontSize: 13, color: "#aaa", lineHeight: 1.65 }}>
            {profile.bio}
          </p>
        )}
      </div>

      {/* ── More works ───────────────────────────────────────────────────── */}
      {otherWorks.length > 0 && (
        <>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 24px" }} />
          <div style={{ padding: "22px 24px 8px", ...s.fadeIn(0.8) }}>
            <h3 style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: "#777",
              marginBottom: 16,
              fontWeight: 500,
            }}>
              More by {artistName.split(" ")[0]}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {otherWorks.map((work, i) => {
                const label = work.caption ?? work.title ?? "Untitled";
                const isImage = !work.content_type || work.content_type === "image";
                const isActive = activeWork?.id === work.id;
                return (
                  <button
                    key={work.id}
                    onClick={() => handleWorkClick(work)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left" as const,
                      outline: isActive ? "2px solid #d4a853" : "none",
                      borderRadius: 6,
                      transition: "outline 0.2s ease",
                    }}
                  >
                    <div style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: 6,
                      overflow: "hidden",
                      background: "#1a1917",
                    }}>
                      {isImage && work.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={work.url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}>
                          <span style={{ fontSize: 9, color: "#555", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
                            {work.content_type ?? "work"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#ddd", lineHeight: 1.4 }}>{label}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {isActive ? (
                          <span style={{ color: "#d4a853" }}>
                            {(hasOriginal && cfg.original_price) ? `$${cfg.original_price.toLocaleString()}` : "Enquire →"}
                          </span>
                        ) : (
                          <span>View</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected work enquiry prompt */}
            {activeWork && (
              <div style={{
                marginTop: 16,
                padding: 14,
                background: "rgba(212,168,83,0.06)",
                border: "1px solid rgba(212,168,83,0.15)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                animation: "fadeUp 0.3s ease",
              }}>
                <p style={{ fontSize: 12, color: "#ccc", lineHeight: 1.4 }}>
                  {activeWork.caption ?? activeWork.title ?? "Untitled"}
                </p>
                <button
                  onClick={() => openEnquiry(`Enquiry: ${activeWork.caption ?? activeWork.title ?? "work"}`)}
                  style={{
                    padding: "8px 16px",
                    background: "#d4a853",
                    border: "none",
                    borderRadius: 6,
                    color: "#0e0d0b",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap" as const,
                    flexShrink: 0,
                  }}
                >
                  Enquire
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Full profile CTA ─────────────────────────────────────────────── */}
      <div style={{ padding: "20px 24px", ...s.fadeIn(1.0) }}>
        <a
          href={`/${profile.username}`}
          style={{
            display: "block",
            width: "100%",
            padding: 14,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            color: "#aaa",
            fontSize: 13,
            fontFamily: "inherit",
            fontWeight: 500,
            letterSpacing: "0.02em",
            textAlign: "center" as const,
            textDecoration: "none",
            transition: "border-color 0.2s, color 0.2s",
          }}
        >
          View full profile on Patronage →
        </a>
      </div>

      {/* ── Footer credit ────────────────────────────────────────────────── */}
      <div style={{
        padding: "16px 24px 32px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        ...s.fadeIn(1.0),
      }}>
        <div>
          {campaign.partner_name && (
            <>
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                Supported by
              </div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                {campaign.partner_name}{dateRange ? ` · ${dateRange}` : ""}
              </div>
            </>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.04em" }}>
          patronage.nz
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#e8e4df",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
