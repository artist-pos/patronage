import { notFound } from "next/navigation";
import { getProfile } from "@/lib/profiles";
import { getPublicCollection, type PublicCollectionEntry } from "@/lib/collection";
import { supabaseTransform } from "@/lib/image";
import { TRUST_TIER_LABELS } from "@/lib/trust-tier";
import type { Metadata } from "next";
import type { CSSProperties } from "react";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ cols?: string; theme?: string; size?: string }>;
}

export const metadata: Metadata = {
  title: "Collection — Patronage",
  // Iframe content shouldn't rank in search; the host page handles that.
  robots: { index: false, follow: false },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

type EmbedTheme = "light" | "dark";
type EmbedSize = "sm" | "md" | "lg";

interface EmbedConfig {
  cols: 2 | 3 | 4;
  theme: EmbedTheme;
  size: EmbedSize;
}

function parseConfig(sp: { cols?: string; theme?: string; size?: string }): EmbedConfig {
  const cols = sp.cols === "2" || sp.cols === "4" ? Number(sp.cols) as 2 | 4 : 3;
  const theme: EmbedTheme = sp.theme === "dark" ? "dark" : "light";
  const size: EmbedSize =
    sp.size === "sm" ? "sm" : sp.size === "lg" ? "lg" : "md";
  return { cols, theme, size };
}

const SIZE_TILE_PX: Record<EmbedSize, number> = { sm: 140, md: 200, lg: 280 };

const THEME_VARS: Record<EmbedTheme, CSSProperties> = {
  light: {
    "--embed-bg": "#ffffff",
    "--embed-fg": "#1c1917",
    "--embed-muted": "#78716c",
    "--embed-tile-bg": "#f5f5f4",
    "--embed-border": "#e7e5e4",
    "--embed-chip-bg": "#f5f5f4",
    "--embed-chip-fg": "#44403c",
  } as CSSProperties,
  dark: {
    "--embed-bg": "#0c0a09",
    "--embed-fg": "#fafaf9",
    "--embed-muted": "#a8a29e",
    "--embed-tile-bg": "#1c1917",
    "--embed-border": "#292524",
    "--embed-chip-bg": "#292524",
    "--embed-chip-fg": "#d6d3d1",
  } as CSSProperties,
};

export default async function EmbedCollectionPage({ params, searchParams }: Props) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const cfg = parseConfig(sp);

  const profile = await getProfile(username);
  if (!profile) notFound();
  const entries = await getPublicCollection(profile.id);

  return (
    <div
      style={{
        ...THEME_VARS[cfg.theme],
        backgroundColor: "var(--embed-bg)",
        color: "var(--embed-fg)",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "24px",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* The site's root layout always renders Header + Footer. Restructuring
          to skip them would require migrating every existing route into a
          route group. Until then, hide them at the embed level with a scoped
          stylesheet — cheap and contained. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > header, body > footer { display: none !important; }
            body > main { padding: 0 !important; flex: none !important; }
            body { background-color: var(--embed-bg) !important; }
          `,
        }}
      />
      {entries.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--embed-muted)" }}>
          No public works yet.
        </p>
      ) : (
        <ul
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))`,
            gap: 16,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {entries.map((entry) => (
            <EmbedTile key={entry.membership.id} entry={entry} size={cfg.size} />
          ))}
        </ul>
      )}

      {/* Non-removable Patronage credit per the spec. Renders on every embed,
          regardless of theme/size. */}
      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: "var(--embed-muted)",
          textAlign: "right",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "underline" }}
        >
          Powered by Patronage
        </a>
      </p>
    </div>
  );
}

function EmbedTile({
  entry,
  size,
}: {
  entry: PublicCollectionEntry;
  size: EmbedSize;
}) {
  const tilePx = SIZE_TILE_PX[size];
  const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";
  const thumb =
    supabaseTransform(entry.artwork.url, { width: tilePx * 2, quality: 80 })
    ?? entry.artwork.url;
  const ledgerHref = entry.artwork.ledger_id
    ? `${SITE_URL}/provenance/${entry.artwork.ledger_id}`
    : null;
  const artistHref = entry.attributedArtist?.username
    ? `${SITE_URL}/${entry.attributedArtist.username}`
    : null;
  const tierLabel = TRUST_TIER_LABELS[entry.trustTier].label;

  return (
    <li>
      {ledgerHref ? (
        <a
          href={ledgerHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            aspectRatio: "1 / 1",
            backgroundColor: "var(--embed-tile-bg)",
            overflow: "hidden",
            borderRadius: 4,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={entry.artwork.title ?? artistName}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            loading="lazy"
          />
        </a>
      ) : (
        <div
          style={{
            aspectRatio: "1 / 1",
            backgroundColor: "var(--embed-tile-bg)",
            overflow: "hidden",
            borderRadius: 4,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={entry.artwork.title ?? artistName}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            loading="lazy"
          />
        </div>
      )}

      <div style={{ marginTop: 8, fontSize: size === "sm" ? 11 : 13, lineHeight: 1.4 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>
          {entry.artwork.title ?? "Untitled"}
        </p>
        <p style={{ margin: "2px 0 0", color: "var(--embed-muted)" }}>
          {artistHref ? (
            <a href={artistHref} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
              {artistName}
            </a>
          ) : (
            artistName
          )}
          {entry.artwork.year ? ` · ${entry.artwork.year}` : ""}
        </p>
        <span
          style={{
            display: "inline-block",
            marginTop: 6,
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            backgroundColor: "var(--embed-chip-bg)",
            color: "var(--embed-chip-fg)",
            border: "1px solid var(--embed-border)",
            padding: "2px 8px",
            borderRadius: 999,
          }}
        >
          {tierLabel}
        </span>
      </div>
    </li>
  );
}
