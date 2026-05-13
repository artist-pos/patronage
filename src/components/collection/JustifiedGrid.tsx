"use client";

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import type { PatronEmbedConfig } from "@/types/database";
import type { PublicCollectionEntry } from "@/lib/collection";
import { TRUST_TIER_LABELS } from "@/lib/trust-tier";

const TRUST_TIER_DOTS: Record<string, string> = {
  recorded_by_artist:  "#5a9e6f",
  confirmed_by_artist: "#5a9e6f",
  recorded_by_holder:  "#bbb",
  resolved_by_patronage: "#bbb",
  disputed: "#bbb",
};

interface Tile {
  entry: PublicCollectionEntry;
  w: number;
  h: number;
}

interface Row {
  tiles: Tile[];
  isLast: boolean;
}

function buildRows(
  entries: PublicCollectionEntry[],
  dimOverrides: Record<string, { ar: number }>,
  containerW: number,
  targetH: number,
  hGap: number,
): Row[] {
  if (containerW <= 0 || entries.length === 0) return [];

  const rows: Row[] = [];
  let batch: PublicCollectionEntry[] = [];
  let batchAR = 0;

  for (const entry of entries) {
    const { width_mm, height_mm } = entry.artwork;
    const dimAR =
      dimOverrides[entry.artwork.id]?.ar ??
      (width_mm && height_mm && height_mm > 0 ? width_mm / height_mm : 1.0);

    batch.push(entry);
    batchAR += dimAR;

    const rowH = (containerW - (batch.length - 1) * hGap) / batchAR;

    if (rowH <= targetH || batch.length >= 4) {
      const clampedH = Math.max(targetH * 0.75, Math.min(rowH, targetH));
      const tiles: Tile[] = batch.map((e) => {
        const { width_mm: w, height_mm: h } = e.artwork;
        const ar =
          dimOverrides[e.artwork.id]?.ar ??
          (w && h && h > 0 ? w / h : 1.0);
        return { entry: e, w: Math.round(ar * clampedH), h: Math.round(clampedH) };
      });
      const used = tiles.reduce((s, t) => s + t.w, 0) + (tiles.length - 1) * hGap;
      if (tiles.length > 0 && used < containerW) {
        tiles[tiles.length - 1].w += containerW - used;
      }
      rows.push({ tiles, isLast: false });
      batch = [];
      batchAR = 0;
    }
  }

  if (batch.length > 0) {
    const targetCapped = targetH * 1.3;
    rows.push({
      tiles: batch.map((e) => {
        const { width_mm: w, height_mm: h } = e.artwork;
        const ar =
          dimOverrides[e.artwork.id]?.ar ??
          (w && h && h > 0 ? w / h : 1.0);
        return { entry: e, w: Math.round(ar * targetCapped), h: Math.round(targetCapped) };
      }),
      isLast: true,
    });
  }

  return rows;
}

interface Props {
  entries: PublicCollectionEntry[];
  config: PatronEmbedConfig;
  isEmbed?: boolean;
  siteUrl?: string;
}

export function JustifiedGrid({ entries, config, isEmbed = false, siteUrl = "https://patronage.nz" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState<number>(0);
  const [dimOverrides, setDimOverrides] = useState<Record<string, { ar: number }>>({});
  const [openEntry, setOpenEntry] = useState<PublicCollectionEntry | null>(null);

  // Measure initial width synchronously before first paint (avoids blank frame)
  useLayoutEffect(() => {
    if (containerRef.current) {
      setContainerW(containerRef.current.offsetWidth);
    }
  }, []);

  // Keep containerW in sync via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape key closes modal
  useEffect(() => {
    if (!openEntry) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenEntry(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEntry]);

  const handleLoad = useCallback((id: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    if (nw > 0 && nh > 0) {
      setDimOverrides((prev) => ({ ...prev, [id]: { ar: nw / nh } }));
    }
  }, []);

  const rows = useMemo(
    () => buildRows(entries, dimOverrides, containerW, config.row_height, config.gap_h),
    [entries, dimOverrides, containerW, config.row_height, config.gap_h],
  );

  const bgStyle = config.theme === "dark"
    ? { background: "#0c0a09", color: "#fafaf9" }
    : config.theme === "transparent"
      ? { background: "transparent" }
      : { background: config.bg_color || "#fafaf8" };

  return (
    <div style={bgStyle}>
      <div ref={containerRef}>
        {rows.map((row, ri) => (
          <div
            key={ri}
            style={{
              display: "flex",
              gap: config.gap_h,
              marginBottom: ri < rows.length - 1 ? config.gap_v : 0,
              alignItems: "flex-start",
            }}
          >
            {row.tiles.map(({ entry, w, h }) => {
              const artistName =
                entry.attributedArtist?.full_name ??
                entry.attributedArtist?.username ??
                "Unknown artist";
              const artistUsername = entry.attributedArtist?.username;
              const tier = entry.trustTier;
              const tierLabel = TRUST_TIER_LABELS[tier]?.label ?? tier;
              const tierDot = TRUST_TIER_DOTS[tier] ?? "#bbb";
              const artworkHref = artistUsername
                ? `${siteUrl}/${artistUsername}/works/${entry.artwork.id}`
                : null;
              const artistHref = artistUsername ? `${siteUrl}/${artistUsername}` : null;

              return (
                <div key={entry.membership.id} style={{ width: w, flexShrink: 0 }}>
                  <div
                    style={{ width: w, height: h, overflow: "hidden", cursor: "pointer", position: "relative" }}
                    onClick={() => setOpenEntry(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setOpenEntry(entry)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.artwork.url}
                      alt={entry.artwork.title ?? artistName}
                      loading="lazy"
                      onLoad={(e) => handleLoad(entry.artwork.id, e)}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>

                  {/* Caption below tile */}
                  <div style={{ paddingTop: 6 }}>
                    {config.show_title && entry.artwork.title && (
                      <p style={{ margin: 0, fontSize: 12, fontStyle: "italic", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {entry.artwork.title}
                      </p>
                    )}
                    {config.show_artist && artistName !== "Unknown artist" && (
                      artistHref ? (
                        <a
                          href={artistHref}
                          target={isEmbed ? "_blank" : undefined}
                          rel={isEmbed ? "noopener noreferrer" : undefined}
                          style={{ display: "block", fontSize: 11, color: "inherit", opacity: 0.6, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", textDecoration: "none" }}
                        >
                          {artistName}
                        </a>
                      ) : (
                        <p style={{ margin: 0, fontSize: 11, opacity: 0.6, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                          {artistName}
                        </p>
                      )
                    )}
                    {(config.show_year && entry.artwork.year) || (config.show_medium && entry.artwork.medium) ? (
                      <p style={{ margin: 0, fontSize: 11, opacity: 0.5, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                        {[
                          config.show_year ? entry.artwork.year : null,
                          config.show_medium ? entry.artwork.medium : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    {config.show_trust && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: tierDot, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 10, opacity: 0.6 }}>{tierLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal */}
      {openEntry && (
        <CollectionModal
          entry={openEntry}
          isEmbed={isEmbed}
          siteUrl={siteUrl}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </div>
  );
}

// ── Inline modal (avoids extra client boundary) ────────────────────────────

function CollectionModal({
  entry,
  isEmbed,
  siteUrl,
  onClose,
}: {
  entry: PublicCollectionEntry;
  isEmbed: boolean;
  siteUrl: string;
  onClose: () => void;
}) {
  const artistName =
    entry.attributedArtist?.full_name ??
    entry.attributedArtist?.username ??
    "Unknown artist";
  const artistUsername = entry.attributedArtist?.username;
  const tier = entry.trustTier;
  const tierLabel = TRUST_TIER_LABELS[tier]?.label ?? tier;
  const tierDesc = TRUST_TIER_LABELS[tier]?.description ?? "";
  const tierDot = TRUST_TIER_DOTS[tier] ?? "#bbb";
  const ledgerId = entry.artwork.ledger_id;
  const artworkHref = artistUsername
    ? `${siteUrl}/${artistUsername}/works/${entry.artwork.id}`
    : null;
  const artistHref = artistUsername ? `${siteUrl}/${artistUsername}` : null;
  const provenanceHref = ledgerId ? `${siteUrl}/provenance/${ledgerId}` : null;

  const openProps = isEmbed
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "stretch",
      }}
      onClick={onClose}
    >
      {/* × close */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.15)",
          border: "none",
          borderRadius: "50%",
          width: 32,
          height: 32,
          color: "#fff",
          cursor: "pointer",
          fontSize: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
        aria-label="Close"
      >
        ×
      </button>

      <div
        style={{ display: "flex", width: "100%", height: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left — image (55%) */}
        <div
          style={{
            flex: "0 0 55%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0,0,0,0.5)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.artwork.url}
            alt={entry.artwork.title ?? artistName}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {/* Right panel (scrollable) */}
        <div
          style={{
            flex: 1,
            background: "#fff",
            overflowY: "auto",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            color: "#1c1917",
          }}
        >
          {/* Title */}
          <h2 style={{ fontSize: 22, fontStyle: "italic", fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
            {entry.artwork.title ?? "Untitled"}
          </h2>

          {/* Artist */}
          {artistName !== "Unknown artist" && (
            artistHref ? (
              <a href={artistHref} {...openProps} style={{ fontSize: 14, color: "#78716c", textDecoration: "none" }}>
                {artistName}
              </a>
            ) : (
              <p style={{ fontSize: 14, color: "#78716c", margin: 0 }}>{artistName}</p>
            )
          )}

          <hr style={{ border: "none", borderTop: "1px solid #e7e5e4", margin: 0 }} />

          {/* Detail rows */}
          {[
            ["Medium", entry.artwork.medium],
            ["Year", entry.artwork.year],
            ["Dimensions", entry.artwork.dimensions],
            ["Edition", entry.artwork.edition],
            ["Acquired", entry.membership.date_acquired_text],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} style={{ display: "flex", gap: 8, fontSize: 13 }}>
              <span style={{ color: "#a8a29e", width: 90, flexShrink: 0 }}>{label}</span>
              <span style={{ color: "#1c1917" }}>{String(value)}</span>
            </div>
          ))}

          {/* Trust tier */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: tierDot,
                marginTop: 4,
                flexShrink: 0,
              }}
            />
            <div>
              <p style={{ margin: 0, fontWeight: 500 }}>{tierLabel}</p>
              <p style={{ margin: "2px 0 0", color: "#78716c", fontSize: 12 }}>{tierDesc}</p>
            </div>
          </div>

          {/* Ledger ID + links */}
          {ledgerId && tier !== "recorded_by_holder" && (
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "#a8a29e", margin: 0 }}>
              {ledgerId}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {provenanceHref && (
              <a href={provenanceHref} {...openProps} style={{ fontSize: 13, color: "#1c1917", textDecoration: "underline" }}>
                View provenance record →
              </a>
            )}
            {artistHref && (
              <a href={artistHref} {...openProps} style={{ fontSize: 13, color: "#1c1917", textDecoration: "underline" }}>
                View artist profile →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
