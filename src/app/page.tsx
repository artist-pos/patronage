import Link from "next/link";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { WhoIsPatronageFor } from "@/components/home/WhoIsPatronageFor";
import { RotatingHeadline } from "@/components/home/RotatingHeadline";
import { FeedCard } from "@/components/feed/FeedCard";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { createPublicClient } from "@/lib/supabase/public";
import { getBannerGradient } from "@/lib/defaults";
import type { ProfileWithImage, Opportunity } from "@/types/database";
import type { ProjectUpdateWithArtist } from "@/types/database";

// ── Cached public data — shared across all visitors, revalidated every 5 min ──

const UPDATE_SELECT = `
  id, artist_id, project_id, image_url, caption, content_type, discipline,
  audio_url, video_url, text_content, embed_url, embed_provider,
  orientation, image_width, image_height, collaborator_ids,
  title, tldr, update_tag, admin_hidden, created_at,
  profiles!project_updates_artist_id_fkey (username, full_name, avatar_url)
`;

const getCachedHomeData = unstable_cache(
  async (today: string) => {
    const supabase = createPublicClient();
    const [artistsRes, oppsRes, updatesRes, oppCountRes, artistCountRes, spotlightRes] =
      await Promise.all([
        // Fetch a wider pool, then curate: profiles with an image and a bio
        // front the section — sparse profiles make the feature card look broken.
        supabase
          .from("profiles")
          .select("id, username, full_name, bio, avatar_url, featured_image_url, medium, career_stage, country, role, created_at, is_active")
          .eq("is_active", true)
          .in("role", ["artist", "owner"])
          .order("created_at", { ascending: false })
          .limit(16),
        supabase
          .from("opportunities")
          .select("id, slug, title, organiser, caption, type, country, city, deadline, opens_at, featured_image_url, is_featured, sub_categories, funding_range, funding_amount, entry_fee, grant_type, recipients_count, is_recurring, recurrence_pattern")
          .eq("is_active", true)
          .eq("status", "published")
          .or(`deadline.gte.${today},deadline.is.null`)
          .order("deadline", { ascending: true, nullsFirst: false })
          .limit(8),
        // NOT filtered on admin_hidden here: this block is unstable_cache'd and
        // shared by every visitor, so the auth-dependent filter has to happen
        // after the cache (see Home() below). Over-fetches 16 for a 12-slot strip
        // so a signed-out viewer still gets a full row once hidden posts drop out.
        supabase
          .from("project_updates")
          .select(UPDATE_SELECT)
          .order("created_at", { ascending: false })
          .limit(16),
        supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("status", "published")
          .or(`deadline.gte.${today},deadline.is.null`),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
          .in("role", ["artist", "owner"]),
        // Admin-set spotlight — the same artist fronting /artists
        supabase
          .from("profiles")
          .select("id, username, full_name, bio, avatar_url, featured_image_url, medium, career_stage, country, role, created_at, is_active")
          .gte("spotlight_until", today)
          .order("spotlight_until", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    // Curate: image + bio first, then image-only, then the rest; cap at 4
    const pool: ProfileWithImage[] = (artistsRes.data ?? []).map((p: any) => ({
      ...p,
      primary_image_url: p.featured_image_url ?? null,
    }));
    const score = (p: ProfileWithImage) =>
      (p.featured_image_url || p.avatar_url ? 2 : 0) + (p.bio ? 1 : 0) + (p.full_name ? 1 : 0);
    const artists = [...pool].sort((a, b) => score(b) - score(a)).slice(0, 4);

    const opportunities = (oppsRes.data ?? []) as Opportunity[];

    const updates: ProjectUpdateWithArtist[] = (updatesRes.data ?? []).map((row: any) => ({
      id: row.id,
      artist_id: row.artist_id,
      project_id: row.project_id ?? null,
      image_url: row.image_url ?? null,
      caption: row.caption ?? null,
      content_type: row.content_type ?? "image",
      discipline: row.discipline ?? null,
      audio_url: row.audio_url ?? null,
      video_url: row.video_url ?? null,
      text_content: row.text_content ?? null,
      embed_url: row.embed_url ?? null,
      embed_provider: row.embed_provider ?? null,
      orientation: row.orientation ?? null,
      image_width: row.image_width ?? null,
      image_height: row.image_height ?? null,
      admin_hidden: row.admin_hidden ?? false,
      created_at: row.created_at,
      artist_username: row.profiles?.username ?? "",
      artist_full_name: row.profiles?.full_name ?? null,
      artist_avatar_url: row.profiles?.avatar_url ?? null,
      collaborator_ids: row.collaborator_ids ?? [],
      title: row.title ?? null,
      tldr: row.tldr ?? null,
      update_tag: row.update_tag ?? "update",
      collaborators: [],
    }));

    const spotlightArtist: ProfileWithImage | null = spotlightRes.data
      ? { ...(spotlightRes.data as any), primary_image_url: (spotlightRes.data as any).featured_image_url ?? null }
      : null;

    return {
      artists,
      // Newest joins in signup order — the mobile "Recently joined" strip
      recentArtists: pool.slice(0, 10),
      spotlightArtist,
      opportunities,
      updates,
      oppCount: oppCountRes.count ?? opportunities.length,
      artistCount: artistCountRes.count ?? artists.length,
    };
  },
  ["home-data-v4"],
  { revalidate: 300, tags: ["home-data"] }
);

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

// ── v2 display helpers ────────────────────────────────────────────────────

function deadlineInfo(deadline: string | null): { label: string; cls: string } {
  if (!deadline) return { label: "Open", cls: "text-[color:var(--fg-muted)]" };
  const days = Math.ceil(
    (new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000
  );
  if (days <= 0) return { label: "Closes today", cls: "text-[color:var(--urgent)]" };
  if (days === 1) return { label: "1 day left", cls: "text-[color:var(--urgent)]" };
  if (days <= 2) return { label: `${days} days left`, cls: "text-[color:var(--urgent)]" };
  if (days <= 14) return { label: `${days} days left`, cls: "text-[color:var(--warning)]" };
  if (days > 21) return { label: `${Math.round(days / 7)} weeks left`, cls: "text-[color:var(--fg-muted)]" };
  return { label: `${days} days left`, cls: "text-[color:var(--fg-muted)]" };
}

function moneyLabel(opp: Opportunity): string | null {
  // Strip parentheticals so long funding strings never blow out the row
  if (opp.funding_range) {
    const short = opp.funding_range.split(" (")[0].trim();
    return short.length > 18 ? short.slice(0, 17).trimEnd() + "…" : short;
  }
  if (opp.funding_amount)
    return `$${Number(opp.funding_amount).toLocaleString("en-NZ")}`;
  if (opp.entry_fee === 0) return "No fee";
  return null;
}

const DISCIPLINES = [
  "Painting", "Sculpture", "Sound", "Photography", "Writing", "Ceramics",
  "Performance", "Weaving", "Printmaking", "Mural", "Installation",
  "Digital Art", "Textile", "Jewellery",
];

// ── v2 building blocks (server-rendered) ──────────────────────────────────

function OppRow({ opp }: { opp: Opportunity }) {
  const d = deadlineInfo(opp.deadline);
  const money = moneyLabel(opp);
  const img = opp.featured_image_url;
  return (
    <Link
      href={`/opportunities/${opp.slug ?? opp.id}`}
      className="grid grid-cols-[44px_1fr_auto] items-center gap-2.5 px-3.5 py-2 transition-colors hover:bg-muted sm:grid-cols-[52px_1fr_auto]"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border border-border bg-white sm:h-[52px] sm:w-[52px]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="px-1 text-center font-mono text-[8px] font-semibold uppercase text-[color:var(--fg-subtle)]">
            {opp.type?.slice(0, 9)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="mb-0.5 truncate text-[13px] font-semibold leading-tight">
          {opp.title}
        </div>
        <div className="mb-1.5 truncate font-mono text-[11px] text-[color:var(--fg-muted)]">
          {opp.organiser}
          {opp.city ? ` · ${opp.city}` : ""}
        </div>
        <div className="flex gap-1">
          {opp.type && (
            <span className="border border-border px-[5px] py-px font-mono text-[10px] lowercase text-[color:var(--fg-muted)]">
              {opp.type}
            </span>
          )}
          {opp.country && (
            <span className="border border-border px-[5px] py-px font-mono text-[10px] text-[color:var(--fg-muted)]">
              {opp.country}
            </span>
          )}
        </div>
      </div>
      <div className="max-w-[104px] shrink-0 text-right sm:max-w-[140px]">
        {money && (
          <div className="mb-0.5 line-clamp-2 font-mono text-[13px] font-semibold leading-tight">{money}</div>
        )}
        <div className={`whitespace-nowrap font-mono text-[10px] ${d.cls}`}>{d.label}</div>
      </div>
    </Link>
  );
}

function artistImage(a: ProfileWithImage): string | null {
  return a.featured_image_url ?? a.avatar_url ?? null;
}

// A bare gradient tile with no image reads as a broken/loading image next
// to real photos — a centred monogram makes it a deliberate placeholder.
function artistInitial(a: ProfileWithImage): string {
  return (a.full_name ?? a.username ?? "?").trim().charAt(0).toUpperCase();
}

function ArtistFeature({ a, spotlit = false }: { a: ProfileWithImage; spotlit?: boolean }) {
  const img = artistImage(a);
  return (
    <Link href={`/${a.username}`} className="pin relative block h-full overflow-hidden border border-[#CFCABF]">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-pin-img
          src={img}
          alt={a.full_name ?? a.username}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-6xl font-semibold text-white/70"
          style={{ background: getBannerGradient(a.username) }}
        >
          {artistInitial(a)}
        </div>
      )}
      {/* Caption overlays the photo — the card's own bottom edge is the
          photo's bottom edge, so it lines up with the artist-list card
          opposite it instead of trailing a separate caption block. */}
      <div
        className="absolute inset-x-0 bottom-0 px-5 pb-4 pt-10"
        style={{
          background:
            "linear-gradient(to top, rgba(20,20,19,.78) 0%, rgba(20,20,19,.4) 55%, rgba(20,20,19,0) 100%)",
        }}
      >
        {spotlit && (
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white/75">
            Featured artist
          </p>
        )}
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <div className="text-xl font-semibold tracking-[-0.022em] text-white">
            {a.full_name ?? a.username}
          </div>
          {a.country && (
            <div className="font-mono text-[11px] text-white/75">{a.country}</div>
          )}
        </div>
        {a.bio && (
          <p className="mb-2.5 line-clamp-2 text-[13px] leading-[1.55] text-white/85">
            {a.bio}
          </p>
        )}
        {a.medium && a.medium.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {a.medium.slice(0, 3).map((m) => (
              <span key={m} className="border border-white/30 px-1.5 py-0.5 font-mono text-[10px] lowercase text-white/85">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function ArtistStripTile({ a }: { a: ProfileWithImage }) {
  const img = artistImage(a);
  return (
    <Link href={`/${a.username}`} className="w-[76px] shrink-0">
      <div className="relative mb-1.5 aspect-square w-full overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={a.full_name ?? a.username}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center font-mono text-xl font-semibold text-white/70"
            style={{ background: getBannerGradient(a.username) }}
          >
            {artistInitial(a)}
          </div>
        )}
      </div>
      <div className="truncate text-[11px] font-semibold leading-[1.3]">
        {a.full_name ?? a.username}
      </div>
      {a.medium?.[0] && (
        <div className="truncate font-mono text-[9px] lowercase text-[color:var(--fg-muted)]">
          {a.medium[0]}
        </div>
      )}
    </Link>
  );
}

function ArtistCompact({ a }: { a: ProfileWithImage }) {
  const img = artistImage(a);
  return (
    <Link href={`/${a.username}`} className="pin flex flex-1 items-center gap-4 overflow-hidden px-4 py-4">
      <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            data-pin-img
            src={img}
            alt={a.full_name ?? a.username}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold text-white/70"
            style={{ background: getBannerGradient(a.username) }}
          >
            {artistInitial(a)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 text-[14px] font-semibold">{a.full_name ?? a.username}</div>
        {a.country && (
          <div className="mb-1.5 font-mono text-[10px] text-[color:var(--fg-muted)]">
            {a.country}
          </div>
        )}
        {a.bio && (
          <p className="truncate text-[12px] leading-[1.5] text-[color:var(--fg-muted)]">
            {a.bio}
          </p>
        )}
      </div>
    </Link>
  );
}


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

              {/* Stats — outside the card, on plain white, bottom-anchored so
                  their baseline lines up with the opportunities panel opposite */}
              <div className="mt-6 flex flex-col gap-3 lg:mt-8 lg:max-w-[620px] lg:flex-row lg:flex-wrap lg:gap-0">
                <div className="lg:mb-0 lg:mr-7 lg:border-r lg:border-[#CFCABF] lg:pr-7">
                  <div className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">
                    {oppCount}+
                  </div>
                  <div className="mt-1.5 font-mono text-[10px] text-[color:var(--fg-subtle)]">
                    opportunities active
                  </div>
                </div>
                <div className="lg:mb-0 lg:mr-7 lg:border-r lg:border-[#CFCABF] lg:pr-7">
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
                    access
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
