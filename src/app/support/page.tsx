import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/format-price";

export const metadata: Metadata = {
  title: "Support artists — Patronage",
  description:
    "Buy work and back artists directly. Most of what you spend goes straight to the artist.",
};

// ── Types for the joined rows we read ───────────────────────────────
type JoinedArtist = {
  username: string | null;
  full_name: string | null;
  avatar_url?: string | null;
};

type WorkRow = {
  id: string;
  slug: string | null;
  title: string | null;
  caption: string | null;
  medium: string | null;
  url: string;
  thumb_url: string | null;
  price_cents: number | null;
  price_currency: "NZD" | "AUD";
  is_poa: boolean;
  artist: JoinedArtist | JoinedArtist[] | null;
};

type TierRow = {
  id: string;
  title: string;
  price: number;
  description: string | null;
  tier_type: "one_off" | "recurring" | null;
  artist: JoinedArtist | JoinedArtist[] | null;
};

type CampaignRow = {
  id: string;
  slug: string;
  title: string;
  campaign_type: string | null;
  cover_image_url: string | null;
  location_address: string | null;
  campaign_end_date: string | null;
  artist: JoinedArtist | JoinedArtist[] | null;
};

const one = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  hoarding: "Hoarding",
  billboard: "Billboard",
  truck_curtain: "Truck curtain",
  packaging: "Packaging",
  art_fair: "Art fair",
  exhibition: "Exhibition",
  market_stall: "Market stall",
  pop_up: "Pop-up",
  other: "Campaign",
};

function daysRemaining(endDate: string | null): string | null {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return "Ends today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

const SECTION_HEADING =
  "text-xs font-medium uppercase tracking-widest text-stone-400";

export default async function SupportPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: workRows },
    { data: tierRows },
    { data: campaignRows },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("artworks")
      .select(
        "id, slug, title, caption, medium, url, thumb_url, price_cents, price_currency, is_poa, artist:profile_id(username, full_name)",
      )
      .eq("is_available", true)
      .eq("hide_available", false)
      .eq("hide_price", false)
      .or("is_poa.eq.true,price_cents.gt.0")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => ({ data: (data ?? []) as unknown as WorkRow[] })),
    supabase
      .from("support_tiers")
      .select(
        "id, title, price, description, tier_type, artist:profiles!inner(username, full_name, avatar_url, support_enabled, stripe_connect_status)",
      )
      .eq("is_active", true)
      .in("tier_type", ["one_off", "recurring"])
      .eq("profiles.support_enabled", true)
      .eq("profiles.stripe_connect_status", "enabled")
      .gt("price", 0)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => ({ data: (data ?? []) as unknown as TierRow[] })),
    supabase
      .from("campaigns")
      .select(
        "id, slug, title, campaign_type, cover_image_url, location_address, campaign_end_date, artist:profiles!artist_profile_id(username, full_name)",
      )
      .eq("status", "live")
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2)
      .then(({ data }) => ({ data: (data ?? []) as unknown as CampaignRow[] })),
  ]);

  const works = (workRows ?? []).filter((w) => one(w.artist)?.username);
  const tiers = (tierRows ?? []).filter((t) => one(t.artist)?.username);
  const campaigns = (campaignRows ?? []).filter((c) => one(c.artist)?.username);

  return (
    <main className="max-w-[1600px] mx-auto px-6 py-12 md:py-16">
      {/* ── Intro ── */}
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Support artists directly
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          95% of every contribution and 90% of every sale goes straight to the
          artist.
        </p>
      </header>

      {/* ── Works for sale ── */}
      {works.length > 0 && (
        <section className="mt-12">
          <h2 className={SECTION_HEADING}>Works for sale</h2>
          <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
            {works.map((w) => {
              const artist = one(w.artist)!;
              const title = w.title ?? w.caption ?? "Untitled";
              const price = formatPrice(
                w.price_cents,
                w.price_currency ?? "NZD",
                w.is_poa,
              );
              return (
                <Link
                  key={w.id}
                  href={`/${artist.username}/works/${w.slug ?? w.id}`}
                  className="group block"
                >
                  <div className="aspect-[4/5] overflow-hidden bg-stone-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={w.thumb_url ?? w.url}
                      alt={title}
                      className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-2.5 space-y-0.5">
                    <p className="text-sm text-stone-900">
                      {artist.full_name ?? artist.username}
                    </p>
                    <p className="text-sm text-stone-500 italic">{title}</p>
                    {w.medium && (
                      <p className="text-xs text-stone-400">{w.medium}</p>
                    )}
                    {price && (
                      <p className="pt-0.5 text-sm text-stone-900">{price}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-8">
            <Link
              href="/works"
              className="text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900 transition-colors"
            >
              View all works
            </Link>
          </div>
        </section>
      )}

      {/* ── Support tiers ── */}
      {tiers.length > 0 && (
        <section className="mt-16">
          <h2 className={SECTION_HEADING}>Support an artist&rsquo;s practice</h2>
          <div className="mt-5 flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
            {tiers.map((t) => {
              const artist = one(t.artist)!;
              const freq = t.tier_type === "recurring" ? "/mo" : " one-off";
              return (
                <Link
                  key={t.id}
                  href={`/${artist.username}?tab=support`}
                  className="group block w-[240px] shrink-0 rounded-xl bg-stone-50 p-5 transition-colors hover:bg-stone-100 md:w-auto"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-stone-200">
                      {artist.avatar_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artist.avatar_url}
                          alt={artist.full_name ?? artist.username ?? ""}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </span>
                    <span className="truncate text-sm text-stone-900">
                      {artist.full_name ?? artist.username}
                    </span>
                  </div>
                  <p className="mt-4 text-sm font-medium text-stone-900">
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    NZD {t.price.toLocaleString("en-NZ")}
                    {freq}
                  </p>
                  {t.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-400">
                      {t.description}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Live campaigns (only when live) ── */}
      {campaigns.length > 0 && (
        <section className="mt-16">
          <h2 className={SECTION_HEADING}>Live campaigns</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {campaigns.map((c) => {
              const artist = one(c.artist)!;
              const left = daysRemaining(c.campaign_end_date);
              return (
                <Link
                  key={c.id}
                  href={`/live/${c.slug}`}
                  className="group block overflow-hidden rounded-xl bg-stone-50 transition-colors hover:bg-stone-100"
                >
                  {c.cover_image_url && (
                    <div className="aspect-[16/9] overflow-hidden bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.cover_image_url}
                        alt={c.title}
                        className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-sm font-medium text-stone-900">
                      {c.title}
                    </p>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {artist.full_name ?? artist.username}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400">
                      {c.campaign_type && (
                        <span>
                          {CAMPAIGN_TYPE_LABEL[c.campaign_type] ??
                            c.campaign_type}
                        </span>
                      )}
                      {c.location_address && <span>{c.location_address}</span>}
                      {left && <span>{left}</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Quiet artist strip ── */}
      <div className="mt-20 border-t border-stone-100 pt-6">
        <p className="text-xs text-stone-400">
          Are you an artist?{" "}
          <Link
            href={user ? "/studio" : "/get-started"}
            className="underline underline-offset-2 hover:text-stone-600 transition-colors"
          >
            Enable support on your profile.
          </Link>
        </p>
      </div>
    </main>
  );
}
