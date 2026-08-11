"use client";

import Link from "next/link";

/* ── Explore mixed-feed pin types (v2 pin vocabulary) ──────────────────────
   These interleave with studio updates in the Explore masonry. All pins are
   containerless per the design language: white surfaces on the #EFEEEC feed
   bg, square mono tags, teal marks on opportunities only. */

export interface OpportunityPinData {
  kind: "opportunity";
  id: string;
  slug: string | null;
  title: string;
  organiser: string;
  city: string | null;
  type: string | null;
  country: string | null;
  funding_range: string | null;
  funding_amount: number | null;
  entry_fee: number | null;
  deadline: string | null;
}

export interface ArtistPinData {
  kind: "artist";
  id: string;
  username: string;
  full_name: string | null;
  image_url: string | null;
  city: string | null;
  country: string | null;
  medium: string[];
  bio: string | null;
}

export interface WorkSalePinData {
  kind: "work";
  id: string;
  url: string | null;
  /** Pre-generated ~480px thumbnail — always prefer over `url` in the masonry */
  thumb_url?: string | null;
  title: string | null;
  year: number | null;
  /** Edition text, e.g. "1 of 3" — shown in the AVAILABLE chip */
  edition?: string | null;
  price_cents: number | null;
  price_currency: string | null;
  is_poa: boolean | null;
  hide_price: boolean | null;
  artist_name: string | null;
  artist_username: string | null;
}

export interface ArticlePinData {
  kind: "article";
  slug: string;
  title: string;
  image_url: string | null;
  published_at: string | null;
}

export type ExplorePin =
  | OpportunityPinData
  | ArtistPinData
  | WorkSalePinData
  | ArticlePinData;

const TAG_CLS =
  "border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)] whitespace-nowrap";

/* Deadline label + urgency colour */
function deadlineBits(deadline: string | null): { label: string; cls: string } {
  if (!deadline) return { label: "Open", cls: "text-[color:var(--fg-muted)]" };
  const days = Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return { label: "Closes today", cls: "text-[color:var(--urgent)]" };
  if (days <= 2) return { label: `${days} day${days === 1 ? "" : "s"} left`, cls: "text-[color:var(--urgent)]" };
  if (days <= 14) return { label: `${days} days left`, cls: "text-[color:var(--warning)]" };
  if (days > 21) return { label: `${Math.round(days / 7)} weeks left`, cls: "text-[color:var(--fg-muted)]" };
  return { label: `${days} days left`, cls: "text-[color:var(--fg-muted)]" };
}

/* Compact money label — strip parentheticals so rows never blow out */
function moneyLabel(p: OpportunityPinData): { amount: string; code: string } | null {
  if (p.funding_range) {
    const short = p.funding_range.split(" (")[0].trim();
    return { amount: short, code: "" };
  }
  if (p.funding_amount)
    return { amount: `$${Number(p.funding_amount).toLocaleString("en-NZ")}`, code: "NZD" };
  if (p.entry_fee === 0) return { amount: "No fee", code: "" };
  return null;
}

/* ── Opportunity pin — white, 3px teal left border, teal kicker ── */
export function OpportunityPin({ p }: { p: OpportunityPinData }) {
  const d = deadlineBits(p.deadline);
  const money = moneyLabel(p);
  return (
    <Link
      href={`/opportunities/${p.slug ?? p.id}`}
      prefetch={false}
      className="pin-opportunity block cursor-pointer"
    >
      <div className="t-kicker mb-2.5">{p.type ?? "Opportunity"}</div>
      <div className="mb-2 text-[15px] font-semibold leading-[1.28] tracking-[-0.018em]">
        {p.title}
      </div>
      <div className="mb-3 truncate font-mono text-[11px] text-[color:var(--fg-muted)]">
        {p.organiser}
        {p.city ? ` · ${p.city}` : ""}
      </div>
      <div className="mb-2.5 flex items-baseline justify-between gap-2 border-t border-border pt-2.5">
        {money ? (
          <span className="truncate font-mono text-base font-semibold">
            {money.amount}{" "}
            {money.code && (
              <span className="text-[10px] font-normal text-[color:var(--fg-muted)]">{money.code}</span>
            )}
          </span>
        ) : (
          <span />
        )}
        <span className={`shrink-0 font-mono text-[11px] ${d.cls}`}>{d.label}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {p.country && <span className={TAG_CLS}>{p.country}</span>}
        {p.entry_fee === 0 && <span className={TAG_CLS}>free</span>}
      </div>
    </Link>
  );
}

/* ── Artist spotlight pin — image top, compact strip below ── */
export function ArtistPin({ p }: { p: ArtistPinData }) {
  const name = p.full_name ?? p.username;
  const loc = [p.city, p.country].filter(Boolean).join(", ");
  return (
    <Link href={`/${p.username}`} prefetch={false} className="pin block cursor-pointer bg-card">
      {p.image_url && (
        <div className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-pin-img
            src={p.image_url}
            alt={name}
            loading="lazy"
            className="block aspect-[4/3] w-full object-cover"
          />
        </div>
      )}
      <div className="px-3.5 pb-3.5 pt-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">{name}</div>
            {loc && (
              <div className="mt-0.5 truncate font-mono text-[10px] text-[color:var(--fg-subtle)]">
                {loc}
              </div>
            )}
          </div>
          <span className="shrink-0 whitespace-nowrap border border-foreground px-2.5 py-1 font-mono text-[11px] font-medium">
            view
          </span>
        </div>
        {p.bio && (
          <p className="mb-2 line-clamp-2 text-[13px] leading-[1.55] text-[color:var(--fg-muted)]">
            {p.bio}
          </p>
        )}
        {p.medium.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {p.medium.slice(0, 2).map((m) => (
              <span key={m} className={`${TAG_CLS} lowercase`}>{m}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/* ── Work for sale pin — image + always-visible AVAILABLE chip ── */
export function WorkSalePin({ p }: { p: WorkSalePinData }) {
  if (!p.url) return null;
  const priceLabel =
    p.is_poa || p.hide_price || p.price_cents == null
      ? "POA"
      : `$${(p.price_cents / 100).toLocaleString("en-NZ")} ${p.price_currency ?? "NZD"}`;
  // Work detail route accepts the artwork id (or slug) after /works/
  const href = p.artist_username ? `/${p.artist_username}/works/${p.id}` : "/works";
  return (
    <Link href={href} prefetch={false} className="pin relative block cursor-pointer overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-pin-img
        src={p.thumb_url ?? p.url}
        alt={p.title ?? "Available work"}
        loading="lazy"
        className="block h-auto w-full"
      />
      <span className="absolute left-2.5 top-2.5 bg-black px-[7px] py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.04em] text-white">
        Available{p.edition ? ` · ${p.edition}` : ""}
      </span>
      <div data-pin-overlay>
        {p.title && (
          <div className="truncate text-[13px] font-medium text-white">
            {p.title}
            {p.year ? `, ${p.year}` : ""}
          </div>
        )}
        <div className="mt-0.5 font-mono text-[13px] font-semibold text-white">{priceLabel}</div>
        {p.artist_name && (
          <div className="mt-0.5 font-mono text-[10px] text-white/45">{p.artist_name}</div>
        )}
      </div>
    </Link>
  );
}

/* ── Article pin — image → tag line → title → author row ── */
export function ArticlePin({ p }: { p: ArticlePinData }) {
  const date = p.published_at
    ? new Date(p.published_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short" })
    : null;
  return (
    <Link href={`/blog/${p.slug}`} prefetch={false} className="pin block cursor-pointer bg-card">
      {p.image_url && (
        <div className="overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-pin-img
            src={p.image_url}
            alt=""
            loading="lazy"
            className="block aspect-[16/10] w-full object-cover"
          />
        </div>
      )}
      <div className="px-4 pb-4 pt-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <span className={TAG_CLS}>article</span>
          {date && (
            <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">{date}</span>
          )}
        </div>
        <div className="mb-3 text-[15px] font-semibold leading-[1.3] tracking-[-0.018em]">
          {p.title}
        </div>
        <div className="border-t border-border pt-2.5">
          <span className="text-xs font-medium">Patronage</span>
        </div>
      </div>
    </Link>
  );
}

export function renderExplorePin(pin: ExplorePin) {
  switch (pin.kind) {
    case "opportunity": return <OpportunityPin key={`o-${pin.id}`} p={pin} />;
    case "artist":      return <ArtistPin key={`a-${pin.id}`} p={pin} />;
    case "work":        return <WorkSalePin key={`w-${pin.id}`} p={pin} />;
    case "article":     return <ArticlePin key={`b-${pin.slug}`} p={pin} />;
  }
}
