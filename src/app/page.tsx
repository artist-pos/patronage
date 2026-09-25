import Link from "next/link";
import type { Metadata } from "next";
import { WhoIsPatronageFor } from "@/components/home/WhoIsPatronageFor";
import { RotatingHeadline } from "@/components/home/RotatingHeadline";
import { FeedCard } from "@/components/feed/FeedCard";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getCachedHomeData } from "@/lib/home-data";
import {
  OppRow,
  ArtistFeature,
  ArtistStripTile,
  ArtistCompact,
  DISCIPLINES,
} from "@/components/home/HomeParts";
import type { ProjectUpdateWithArtist } from "@/types/database";

export const metadata: Metadata = {
  title: "Patronage | Art Grants & Opportunities for NZ & Australian Artists",
  description:
    "Patronage connects New Zealand and Australian artists with grants, residencies, commissions, and open calls. Live opportunities updated weekly.",
  alternates: { canonical: "https://patronage.nz" },
  openGraph: {
    title: "Patronage | Art Grants & Opportunities for NZ & Australian Artists",
    description:
      "Patronage connects New Zealand and Australian artists with grants, residencies, commissions, and open calls. Live opportunities updated weekly.",
    url: "https://patronage.nz",
    type: "website",
  },
};



// ── Page ──────────────────────────────────────────────────────────────────

export default async function Home() {
  const today = new Date().toISOString().split("T")[0];
  // Auth (request-deduped with Header) and cached home data run concurrently.
  const [{ user }, { artists, recentArtists, spotlightArtist, opportunities, updates, oppCount, artistCount }] =
    await Promise.all([getServerUser(), getCachedHomeData(today)]);
  const isAuthenticated = !!user;
  const isNewUser = !!user && !!user.created_at &&
    (Date.now() - new Date(user.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

  // admin_hidden (migration 177) is applied here rather than in the cached query
  // above, which is shared across all visitors: signed-out viewers lose moderated
  // posts, everyone with an account sees the strip unchanged. Sliced to 12 after
  // filtering — the query over-fetches 16 to absorb the drop-outs.
  const visibleUpdates = (isAuthenticated ? updates : updates.filter((u) => !u.admin_hidden))
    .slice(0, 12);

  // From-the-studio preview replicates Explore: same cards, same 5-column
  // masonry (columns collapse responsively via hidden classes).
  const previewCols: ProjectUpdateWithArtist[][] = [[], [], [], [], []];
  visibleUpdates.forEach((u, i) => previewCols[i % 5].push(u));
  const previewColCls = [
    "flex flex-col gap-2 flex-1 min-w-0",
    "flex flex-col gap-2 flex-1 min-w-0",
    "hidden sm:flex flex-col gap-2 flex-1 min-w-0",
    "hidden lg:flex flex-col gap-2 flex-1 min-w-0",
    "hidden xl:flex flex-col gap-2 flex-1 min-w-0",
  ];

  // Feature the admin-set spotlight artist (same as /artists); curated fallback
  const featureArtist = spotlightArtist ?? artists[0];
  const compactArtists = artists
    .filter((a) => a.id !== featureArtist?.id)
    .slice(0, 3);

  return (
    <div>
      {/* ══ HERO — split: proposition left / live opportunities right ══ */}
      {!isAuthenticated && (
        <section>
          <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[5fr_4fr] lg:items-stretch">
            {/* LEFT: one cream card around everything from "Aotearoa" through
                the 3 role buttons; stats sit outside it, on plain white */}
            <div className="flex flex-col px-6 pb-7 pt-11 sm:px-12 lg:justify-between lg:pb-9">
              <div className="max-w-[620px] border border-[#CFCABF] bg-[#E3DFDA]/55 p-8 sm:p-10">
                <p className="mb-3.5 font-mono text-[11px] tracking-[0.06em] text-[color:var(--fg-subtle)]">
                  Aotearoa
                </p>
                <h1 className="mb-3 text-[44px] font-semibold leading-[0.98] tracking-[-0.038em] sm:text-[56px]">
                  Find
                  <br />
                  <RotatingHeadline />
                </h1>
                <p className="mb-4.5 max-w-[400px] text-base leading-[1.6] text-[color:var(--fg-muted)]">
                  Grants, residencies, commissions, open calls.
                </p>

                {/* Primary CTA — white panel, brand-green arrow block, beveled seam */}
                <Link
                  href="/opportunities"
                  className="mb-4.5 flex max-w-[420px] items-stretch border border-[#CFCABF]"
                >
                  <span className="flex-1 bg-white px-5 py-4">
                    <span className="mb-1 block text-[15px] font-semibold">
                      Browse opportunities
                    </span>
                    <span className="block font-mono text-[11px] text-[color:var(--fg-muted)]">
                      {oppCount}+ active · updated weekly
                    </span>
                  </span>
                  <span
                    className="w-1.5 shrink-0"
                    style={{
                      background:
                        "linear-gradient(to right, rgba(0,0,0,.14), rgba(255,255,255,.3))",
                    }}
                  />
                  <span
                    className="flex w-14 shrink-0 items-center justify-center bg-brand text-xl text-white"
                    style={{
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,.22), inset 0 -3px 6px rgba(0,0,0,.18)",
                    }}
                  >
                    →
                  </span>
                </Link>

                {/* Role chips — white, inside the same card */}
                <div className="flex max-w-[420px] flex-col gap-2">
                  <Link
                    href="/auth/signup?role=artist"
                    className="border border-[#CFCABF] bg-white px-3 py-2 font-mono text-[11px] text-[#444] transition-colors hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    I&apos;m an artist
                  </Link>
                  <Link
                    href="/auth/signup?role=partner"
                    className="border border-[#CFCABF] bg-white px-3 py-2 font-mono text-[11px] text-[#444] transition-colors hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    I represent an organisation
                  </Link>
                  <Link
                    href="/auth/signup?role=patron"
                    className="border border-[#CFCABF] bg-white px-3 py-2 font-mono text-[11px] text-[#444] transition-colors hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    I support artists
                  </Link>
                </div>
              </div>

              {/* Stats — outside the card, on plain white. Three equal columns on
                  mobile (a grid never wraps, so the dividers can't be orphaned), a
                  flex row from lg up, bottom-anchored so their baseline lines up
                  with the opportunities panel opposite */}
              <div className="mt-6 grid grid-cols-3 gap-3 lg:mt-8 lg:flex lg:max-w-[620px] lg:flex-row lg:flex-wrap lg:gap-0">
                <div className="border-r border-[#CFCABF] pr-3 lg:mb-0 lg:mr-7 lg:pr-7">
                  <div className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">
                    {oppCount}+
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">
                    opportunities active
                  </div>
                </div>
                <div className="border-r border-[#CFCABF] pr-3 lg:mb-0 lg:mr-7 lg:pr-7">
                  <div className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">
                    {artistCount}
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">
                    artists
                  </div>
                </div>
                <div className="lg:mb-0">
                  <div className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">
                    Free
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">
                    to access
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: closing-soon panel — floats free of the header
                and the discipline marquee: fixed row count, no scroll,
                whitespace on every side */}
            <div className="px-4 pb-8 sm:px-6 lg:py-9 lg:pl-0 lg:pr-8">
              <div className="flex h-full flex-col border border-border bg-white">
                {/* header + rows move down together to hug the green bar —
                    leftover space lands above them, not between rows and button */}
                <div className="lg:mt-auto">
                  <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
                    <div className="flex items-center gap-[7px]">
                      <span className="h-[7px] w-[7px] shrink-0 bg-[#B23A2E]" />
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-[#B23A2E]">
                        Closing soon
                      </span>
                    </div>
                    <Link
                      href="/opportunities"
                      className="font-mono text-[11px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
                    >
                      All {oppCount}+ →
                    </Link>
                  </div>
                  <div className="flex flex-col gap-1 bg-background">
                    {opportunities.slice(0, 6).map((opp) => (
                      <OppRow key={opp.id} opp={opp} />
                    ))}
                    {opportunities.length === 0 && (
                      <p className="px-5 py-4 text-sm text-[color:var(--fg-muted)]">
                        No opportunities yet.
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href="/opportunities"
                  className="flex shrink-0 items-center justify-between border-t border-border bg-brand px-5 py-3.5 text-white transition-opacity hover:opacity-85"
                >
                  <span>
                    <span className="mb-0.5 block text-[13px] font-medium">
                      Browse all opportunities
                    </span>
                    <span className="block font-mono text-[10px] text-white/65">
                      {oppCount}+ active · updated weekly
                    </span>
                  </span>
                  <span className="text-lg">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══ AUTHENTICATED: live opportunities section ══ */}
      {isAuthenticated && (
        <section className="mx-auto max-w-[1600px] px-6 pt-8">
          {isNewUser && (
            <p className="mb-4 text-base text-[color:var(--fg-muted)]">
              Welcome to Patronage. Here&rsquo;s what&rsquo;s happening.
            </p>
          )}
          <div className="mb-3.5 flex items-baseline justify-between">
            <span className="flex items-center gap-[7px] font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#B23A2E]">
              <span className="h-[7px] w-[7px] bg-[#B23A2E]" />
              Live opportunities
            </span>
            <Link
              href="/opportunities"
              className="font-mono text-[11px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
            >
              All {oppCount}+ →
            </Link>
          </div>
          <div className="border border-[#B9C2A8] bg-[#E3DFDA]/55 p-4">
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2 md:gap-x-6 md:gap-y-1">
              {opportunities.map((opp) => (
                <OppRow key={opp.id} opp={opp} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ DISCIPLINE STRIP — marquee ══ */}
      <div className="mt-8 flex items-center overflow-hidden border-b border-t border-[#CFCABF] bg-[#E3DFDA]/55 py-[11px]">
        <div
          className="flex w-max items-center"
          style={{ animation: "scroll-left 55s linear infinite" }}
        >
          {[0, 1].map((dup) => (
            <span key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {DISCIPLINES.map((d) => (
                <span key={`${dup}-${d}`} className="flex items-center">
                  <span className="whitespace-nowrap px-4 font-mono text-[11px] text-[color:var(--fg-muted)]">
                    {d}
                  </span>
                  <span className="px-1 text-border">·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ══ ARTISTS ══ */}
      {/* Mobile: compact "Recently joined" strip — one short swipeable band */}
      {recentArtists.length > 0 && (
        <div className="border-b border-border bg-background px-3.5 pb-2.5 pt-3.5 lg:hidden">
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">Recently joined</span>
            <Link
              href="/artists"
              className="font-mono text-[10px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
            >
              All artists →
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {recentArtists.map((a) => (
              <ArtistStripTile key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      {/* Desktop: feature + compact grid */}
      <section className="hidden bg-white px-6 py-12 lg:block">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="t-section-label">Artists on Patronage</span>
            <Link
              href="/artists"
              className="font-mono text-[11px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
            >
              All artists →
            </Link>
          </div>
          {artists.length > 0 ? (
            <div className="grid grid-cols-2 items-stretch gap-2">
              {featureArtist && (
                <ArtistFeature a={featureArtist} spotlit={!!spotlightArtist} />
              )}
              {/* One card holding all three artists — matches the single-card
                  pattern used by the opportunities panel opposite it. */}
              <div className="flex h-full flex-col border border-[#CFCABF] bg-[#E3DFDA]/55">
                {compactArtists.map((a) => (
                  <ArtistCompact key={a.id} a={a} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--fg-muted)]">No artists yet.</p>
          )}
        </div>
      </section>

      {/* ══ FEED PREVIEW — straight from Explore: same cards, same 5-column
             masonry, cut with a fade-out ══ */}
      {visibleUpdates.length > 0 && (
        <section className="border-t border-border bg-background">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex items-baseline justify-between px-6 pb-5 pt-8">
              <h2 className="text-xl font-semibold tracking-[-0.02em]">
                From the studio
              </h2>
              <Link
                href="/feed"
                className="font-mono text-[11px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
              >
                Explore feed →
              </Link>
            </div>
            <div className="relative max-h-[520px] overflow-hidden px-6">
              <div className="flex items-start gap-2">
                {previewCols.map((col, i) => (
                  <div key={i} className={previewColCls[i]}>
                    {col.map((u) => (
                      <FeedCard key={u.id} u={u} />
                    ))}
                  </div>
                ))}
              </div>
              {/* Photos are the base layer; this gradient is an overlay on top
                  of them (transparent → cream), and the button sits on top of
                  that — three distinct layers, not one flat section colour. */}
              <div
                className="absolute bottom-0 left-0 right-0 flex h-56 items-end justify-center pb-6"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(227,223,218,0) 0%, rgba(227,223,218,.36) 35%, rgba(227,223,218,.53) 60%, rgba(227,223,218,.55) 80%)",
                }}
              >
                <Link
                  href="/feed"
                  className="bg-brand px-5 py-3 font-mono text-xs font-semibold text-white transition-opacity hover:opacity-85"
                >
                  Explore updates →
                </Link>
              </div>
            </div>
            {/* white → cream, blending into the section below and signalling
                there's more to scroll to, same cue as the photo fade above */}
            <div
              className="h-16"
              style={{
                background:
                  "linear-gradient(to bottom, var(--background) 0%, rgba(227,223,218,.55) 100%)",
              }}
            />
          </div>
        </section>
      )}

      {/* ══ THREE ROLES — signed-out only ══ */}
      {!isAuthenticated && <WhoIsPatronageFor />}
    </div>
  );
}
