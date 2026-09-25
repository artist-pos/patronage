import Link from "next/link";
import { getBannerGradient } from "@/lib/defaults";
import type { ProfileWithImage, Opportunity } from "@/types/database";

// ── v2 display helpers ────────────────────────────────────────────────────

export function deadlineInfo(deadline: string | null): { label: string; cls: string } {
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

export function moneyLabel(opp: Opportunity): string | null {
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

export const DISCIPLINES = [
  "Painting", "Sculpture", "Sound", "Photography", "Writing", "Ceramics",
  "Performance", "Weaving", "Printmaking", "Mural", "Installation",
  "Digital Art", "Textile", "Jewellery",
];

// ── v2 building blocks (server-rendered) ──────────────────────────────────

/** "glass": for frosted panels — tags become soft filled chips (a grey border
 *  on translucent grey reads muddy), the logo tile loses its outline, and the
 *  hover tint lightens instead of greying. */
export function OppRow({ opp, variant = "default" }: { opp: Opportunity; variant?: "default" | "glass" }) {
  const glass = variant === "glass";
  const tagCls = glass
    ? "bg-white/75 px-1.5 py-px font-mono text-[10px] text-foreground/70"
    : "border border-border px-[5px] py-px font-mono text-[10px] text-[color:var(--fg-muted)]";
  const d = deadlineInfo(opp.deadline);
  const money = moneyLabel(opp);
  const img = opp.featured_image_url;
  const meta = (
    <>
      <div className="mb-0.5 truncate text-[13px] font-semibold leading-tight">{opp.title}</div>
      <div className="mb-1.5 truncate font-mono text-[11px] text-[color:var(--fg-muted)]">
        {opp.organiser}
        {opp.city ? ` · ${opp.city}` : ""}
      </div>
      <div className="flex gap-1">
        {opp.type && <span className={`${tagCls} lowercase`}>{opp.type}</span>}
        {opp.country && <span className={tagCls}>{opp.country}</span>}
      </div>
    </>
  );

  if (glass) {
    // Thumbnail spans exactly the text block — top of the title to the bottom
    // of the tags. The block is a fixed 61px (13px title + 11px organiser +
    // 10px tags, all fixed leading), so the square is sized to match; a
    // stretched-height aspect-ratio tile collapses to zero width in flexbox.
    return (
      <Link
        href={`/opportunities/${opp.slug ?? opp.id}`}
        className="grid grid-cols-[1fr_auto] items-center gap-3 px-3.5 py-2 transition-colors hover:bg-white/40"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="relative flex size-[61px] shrink-0 items-center justify-center overflow-hidden bg-white">
            {img ? (
              // Out of flow, so the image's own size can't drive the tile's.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" className="absolute inset-0 h-full w-full object-contain" loading="lazy" />
            ) : (
              <span className="px-1 text-center font-mono text-[8px] font-semibold uppercase text-[color:var(--fg-subtle)]">
                {opp.type?.slice(0, 9)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">{meta}</div>
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

  return (
    <Link
      href={`/opportunities/${opp.slug ?? opp.id}`}
      className={`grid grid-cols-[44px_1fr_auto] items-center gap-2.5 px-3.5 py-2 transition-colors sm:grid-cols-[52px_1fr_auto] ${glass ? "hover:bg-white/40" : "hover:bg-muted"}`}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden bg-white sm:h-[52px] sm:w-[52px] ${glass ? "" : "border border-border"}`}>
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
            <span className={`${tagCls} lowercase`}>
              {opp.type}
            </span>
          )}
          {opp.country && (
            <span className={tagCls}>
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

export function artistImage(a: ProfileWithImage): string | null {
  return a.featured_image_url ?? a.avatar_url ?? null;
}

// A bare gradient tile with no image reads as a broken/loading image next
// to real photos — a centred monogram makes it a deliberate placeholder.
export function artistInitial(a: ProfileWithImage): string {
  return (a.full_name ?? a.username ?? "?").trim().charAt(0).toUpperCase();
}

export function ArtistFeature({
  a,
  spotlit = false,
  bare = false,
}: {
  a: ProfileWithImage;
  spotlit?: boolean;
  /** No outline — for surfaces where tone, not a border, does the separating. */
  bare?: boolean;
}) {
  const img = artistImage(a);
  return (
    <Link href={`/${a.username}`} className={`pin relative block h-full overflow-hidden ${bare ? "" : "border border-[#CFCABF]"}`}>
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

export function ArtistStripTile({ a }: { a: ProfileWithImage }) {
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

export function ArtistCompact({ a }: { a: ProfileWithImage }) {
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
