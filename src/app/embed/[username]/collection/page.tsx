import { notFound } from "next/navigation";
import { getProfile } from "@/lib/profiles";
import { getPublicCollection } from "@/lib/collection";
import { JustifiedGrid } from "@/components/collection/JustifiedGrid";
import { DEFAULT_EMBED_CONFIG } from "@/types/database";
import type { PatronEmbedConfig } from "@/types/database";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{
    rh?: string; gh?: string; gv?: string;
    title?: string; artist?: string; year?: string;
    medium?: string; trust?: string; theme?: string; bg?: string;
    group?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Collection — Patronage",
  robots: { index: false, follow: false },
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function parseConfig(sp: Awaited<Props["searchParams"]>): PatronEmbedConfig {
  return {
    row_height: sp.rh ? Math.max(80, Math.min(600, parseInt(sp.rh, 10))) || DEFAULT_EMBED_CONFIG.row_height : DEFAULT_EMBED_CONFIG.row_height,
    gap_h: sp.gh != null ? Math.max(0, Math.min(40, parseInt(sp.gh, 10))) : DEFAULT_EMBED_CONFIG.gap_h,
    gap_v: sp.gv != null ? Math.max(0, Math.min(40, parseInt(sp.gv, 10))) : DEFAULT_EMBED_CONFIG.gap_v,
    show_title: sp.title !== "0",
    show_artist: sp.artist !== "0",
    show_year: sp.year === "1",
    show_medium: sp.medium === "1",
    show_trust: sp.trust !== "0",
    theme: sp.theme === "dark" ? "dark" : sp.theme === "transparent" ? "transparent" : "light",
    bg_color: sp.bg ? `#${sp.bg.replace(/^#/, "")}` : DEFAULT_EMBED_CONFIG.bg_color,
  };
}

export default async function EmbedCollectionPage({ params, searchParams }: Props) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);

  const profile = await getProfile(username);
  if (!profile) notFound();

  const allEntries = await getPublicCollection(profile.id);
  const entries = sp.group
    ? allEntries.filter(e => e.membership.group_id === sp.group)
    : allEntries;

  const config = parseConfig(sp);

  const bgStyle =
    config.theme === "dark"
      ? { background: "#0c0a09", color: "#fafaf9" }
      : config.theme === "transparent"
        ? { background: "transparent" }
        : { background: config.bg_color };

  return (
    <div
      style={{
        ...bgStyle,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "16px",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body > header, body > footer { display: none !important; }
            body > main { padding: 0 !important; flex: none !important; }
          `,
        }}
      />

      {entries.length === 0 ? (
        <p style={{ fontSize: 14, color: config.theme === "dark" ? "#a8a29e" : "#78716c" }}>
          No public works yet.
        </p>
      ) : (
        <JustifiedGrid entries={entries} config={config} isEmbed siteUrl={SITE_URL} />
      )}

      <p
        style={{
          marginTop: 16,
          fontSize: 11,
          color: config.theme === "dark" ? "#78716c" : "#a8a29e",
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
