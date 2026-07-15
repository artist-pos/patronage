import Link from "next/link";
import Image from "next/image";
import { Globe, Instagram } from "lucide-react";
import { MessageButton } from "@/components/profile/MessageButton";
import { FollowButton } from "@/components/profile/FollowButton";
import { TrackedLink } from "@/components/profile/TrackedLink";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import { getBannerGradient } from "@/lib/defaults";
import type { Profile, Opportunity } from "@/types/database";

// ── v2 partner + patron profiles (brief: design_handoff_partner_patron_profiles)
// Partner = credibility page: cover w/ logo, trust stats, active + past rounds,
// commissioned artists. Patron = donor wall: cover w/ big name, following grid,
// collected works — no dollar amounts anywhere.

const SECTION_LABEL = "font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]";
const ICON_BTN = "flex h-9 w-9 shrink-0 items-center justify-center border border-border text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground";
const BADGE_GREEN = "bg-[#E1F5EE] px-[7px] py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[#085041]";
const BADGE_NEUTRAL = "bg-muted px-[7px] py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[color:var(--fg-muted)]";
const INNER = "mx-auto max-w-[1280px] px-5 sm:px-12";

export interface ArtistTileData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  medium?: string[] | null;
}

type ProfileForView = Profile & {
  city?: string | null;
  organisation_type?: string | null;
  donation_enabled?: boolean;
  donation_url?: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function deadlineLabel(deadline: string | null): { label: string; cls: string } {
  if (!deadline) return { label: "Open", cls: "text-[color:var(--fg-muted)]" };
  const days = Math.ceil(
    (new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000
  );
  if (days <= 0) return { label: "Closes today", cls: "text-[color:var(--urgent)]" };
  if (days <= 5) return { label: `Closing soon · ${days} day${days !== 1 ? "s" : ""}`, cls: "text-[color:var(--warning)]" };
  return { label: `Closes in ${days} days`, cls: "text-[color:var(--fg-muted)]" };
}

// Shared thumbnail tile — image dims on hover, dark caption overlay fades in
function ArtistTile({ a }: { a: ArtistTileData }) {
  const img = a.avatar_url
    ? a.avatar_url
    : null;
  return (
    <Link href={`/${a.username}`} className="group relative block overflow-hidden">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={a.full_name ?? a.username}
          className="aspect-square w-full object-cover transition-opacity duration-[260ms] group-hover:opacity-[.78]"
          loading="lazy"
        />
      ) : (
        <div
          className="aspect-square w-full transition-opacity duration-[260ms] group-hover:opacity-[.78]"
          style={{ background: getBannerGradient(a.username) }}
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-black/75 px-2.5 py-2 opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100">
        <p className="truncate text-[11px] text-white">{a.full_name ?? a.username}</p>
        {a.medium?.[0] && (
          <p className="mt-px truncate font-mono text-[9px] lowercase text-white/60">{a.medium[0]}</p>
        )}
      </div>
    </Link>
  );
}

function IconLinks({ profile }: { profile: ProfileForView }) {
  return (
    <>
      {profile.website_url && (
        <TrackedLink
          href={profile.website_url}
          profileId={profile.id}
          username={profile.username}
          eventType="website_click"
          className={ICON_BTN}
        >
          <Globe className="h-[15px] w-[15px]" />
        </TrackedLink>
      )}
      {profile.instagram_handle && (
        <a
          href={`https://instagram.com/${profile.instagram_handle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          title={`@${profile.instagram_handle}`}
          className={ICON_BTN}
        >
          <Instagram className="h-[15px] w-[15px]" />
        </a>
      )}
      <ShareTrigger
        variant="icon"
        className={ICON_BTN}
        payload={{
          type: "profile",
          title: profile.full_name ?? profile.username,
          sub: [profile.city, profile.country].filter(Boolean).join(", "),
          price: null,
          tag: profile.role === "partner" ? "PARTNER" : "PATRON",
          handle: `@${profile.username}`,
          imageUrl: profile.avatar_url,
          shareUrl: `https://patronage.nz/${profile.username}`,
        }}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════ PARTNER ═════

export interface PastOpportunityRow {
  id: string;
  slug: string | null;
  title: string;
  type: string;
  deadline: string | null;
  selectedCount: number;
}

interface PartnerProps {
  profile: ProfileForView;
  displayName: string;
  isOwner: boolean;
  canMessage: boolean;
  verified: boolean;
  activeOpps: Opportunity[];
  pastOpps: PastOpportunityRow[];
  commissionedArtists: ArtistTileData[];
  listedCount: number;
  selectedTotal: number;
}

export function PartnerProfileView({
  profile, displayName, isOwner, canMessage, verified,
  activeOpps, pastOpps, commissionedArtists, listedCount, selectedTotal,
}: PartnerProps) {
  const cover = profile.featured_image_url
    ? profile.featured_image_url
    : null;
  const loc = [profile.city, profile.country].filter(Boolean).join(", ");
  const sinceYear = profile.created_at ? new Date(profile.created_at).getFullYear() : null;
  const orgType = profile.organisation_type
    ? profile.organisation_type.replace(/_/g, " ")
    : "Partner";

  const stats: Array<[string, string]> = [];
  if (listedCount > 0) stats.push([String(listedCount), `opportunit${listedCount !== 1 ? "ies" : "y"} listed`]);
  if (activeOpps.length > 0) stats.push([String(activeOpps.length), "active now"]);
  if (selectedTotal > 0) stats.push([String(selectedTotal), "artists selected"]);
  if (sinceYear) stats.push([String(sinceYear), "partner since"]);

  return (
    <div>
      {/* ── Cover ── */}
      <div className="relative h-[280px] w-full overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${displayName} cover`}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg,#0d1b1a,#123330 60%,#1a4a44)" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.65) 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-8 sm:px-12">
          <div className="mx-auto max-w-[1280px]">
            <Link
              href="/partners"
              className="mb-3.5 inline-block font-mono text-[10px] tracking-[0.12em] text-white/50 transition-colors hover:text-white/85"
            >
              ← Partners
            </Link>
            <div className="flex items-end gap-5">
              <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden bg-white">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName}
                    width={68}
                    height={68}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[22px] font-semibold text-foreground">
                    {initials(displayName)}
                  </span>
                )}
              </div>
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">
                  {orgType}
                </p>
                <h1 className="text-[38px] font-semibold leading-none tracking-[-0.03em] text-white">
                  {displayName}
                </h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Identity bar ── */}
      <div className="border-b border-border bg-background">
        <div className={`${INNER} flex flex-wrap items-start justify-between gap-6 py-5`}>
          <div className="max-w-[640px]">
            {profile.bio && (
              <p className="mb-2.5 text-base leading-[1.6] text-[color:var(--fg-muted)] whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3.5">
              {loc && (
                <span className="font-mono text-xs text-[color:var(--fg-subtle)]">{loc}</span>
              )}
              {verified && <span className={BADGE_GREEN}>Verified partner</span>}
              {profile.organisation_type === "charity" && (
                <span className={BADGE_NEUTRAL}>Registered charity</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isOwner && (
              <Link
                href="/profile/edit"
                className="inline-flex h-9 items-center border border-border px-4 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                Edit Profile
              </Link>
            )}
            {canMessage && (
              <MessageButton otherUserId={profile.id} label="Enquire about a programme" variant="solid" />
            )}
            {profile.organisation_type === "charity"
              && profile.donation_enabled
              && profile.donation_url && (
              <a
                href={profile.donation_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-85"
              >
                Support
              </a>
            )}
            <IconLinks profile={profile} />
          </div>
        </div>
      </div>

      {/* ── Trust stats — hairline dividers, no boxes ── */}
      {stats.length > 0 && (
        <div className="border-b border-border">
          <div className={`${INNER} flex flex-wrap gap-y-4 py-6`}>
            {stats.map(([value, label]) => (
              <div key={label} className="mr-6 border-r border-border pr-6 last:mr-0 last:border-r-0 last:pr-0">
                <p className="font-mono text-[26px] font-semibold tracking-[-0.01em]">{value}</p>
                <p className="mt-1 font-mono text-[11px] text-[color:var(--fg-subtle)]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active opportunities ── */}
      {activeOpps.length > 0 && (
        <div className="border-b border-border bg-feed-bg">
          <div className={`${INNER} py-9`}>
            <h2 className={`${SECTION_LABEL} mb-[18px]`}>Active opportunities</h2>
            {activeOpps.map((opp) => {
              const d = deadlineLabel(opp.deadline);
              return (
                <Link
                  key={opp.id}
                  href={`/opportunities/${opp.slug ?? opp.id}`}
                  className="mb-[2px] flex items-center justify-between gap-5 border-l-[3px] border-brand bg-card px-5 py-[18px] transition-colors hover:bg-[color:var(--tint)]"
                >
                  <div className="min-w-0">
                    <p className="mb-1 truncate text-base font-medium">{opp.title}</p>
                    <p className="font-mono text-[11px] text-[color:var(--fg-muted)]">
                      {[opp.type, opp.city ?? opp.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className={`shrink-0 text-right font-mono text-[11px] font-medium ${d.cls}`}>
                    {d.label}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Past opportunities — the plain list IS the trust signal ── */}
      {pastOpps.length > 0 && (
        <div className="border-b border-border">
          <div className={`${INNER} py-9`}>
            <h2 className={`${SECTION_LABEL} mb-[18px]`}>Past opportunities</h2>
            <div className="border-t border-border">
              {pastOpps.map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between gap-5 border-b border-border py-3.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{opp.title}</p>
                    <p className="mt-[3px] font-mono text-[11px] text-[color:var(--fg-subtle)]">
                      {[opp.deadline ? new Date(opp.deadline).getFullYear() : null, opp.type]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {opp.selectedCount > 0 && (
                    <p className="shrink-0 font-mono text-xs text-[color:var(--fg-muted)]">
                      {opp.selectedCount} artist{opp.selectedCount !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Commissioned artists ── */}
      {commissionedArtists.length > 0 && (
        <div className="border-b border-border bg-feed-bg">
          <div className={`${INNER} py-9`}>
            <div className="mb-[18px] flex items-baseline justify-between">
              <h2 className={SECTION_LABEL}>Commissioned artists</h2>
              <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                {selectedTotal} artist{selectedTotal !== 1 ? "s" : ""}, through Patronage
              </span>
            </div>
            <div className="grid grid-cols-2 gap-[2px] sm:grid-cols-3 lg:grid-cols-6">
              {commissionedArtists.map((a) => (
                <ArtistTile key={a.id} a={a} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Contact ── */}
      <div className="border-b border-border bg-feed-bg">
        <div className={`${INNER} grid grid-cols-1 items-start gap-8 py-9 lg:grid-cols-[2fr_1fr] lg:gap-16`}>
          <div>
            <h2 className={`${SECTION_LABEL} mb-3.5`}>About the programme</h2>
            <p className="text-[15.5px] leading-[1.72] text-[color:var(--fg-muted)]">
              {displayName} lists opportunities for artists through Patronage
              {sinceYear ? ` — a partner since ${sinceYear}.` : "."}
            </p>
          </div>
          <div>
            <h2 className={`${SECTION_LABEL} mb-3.5`}>Contact</h2>
            <p className="mb-4 text-sm leading-[1.6] text-[color:var(--fg-muted)]">
              For activation and strategy enquiries, reach the Patronage partnerships team.
            </p>
            <Link
              href="/partners#contact"
              className="block w-full bg-foreground px-5 py-[9px] text-center text-[13px] font-medium text-background transition-opacity hover:opacity-85"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════ PATRON ══════

export interface CollectedWorkTile {
  id: string;
  url: string | null;
  title: string | null;
  artistName: string | null;
  href: string | null;
}

interface PatronProps {
  profile: ProfileForView;
  displayName: string;
  isOwner: boolean;
  canMessage: boolean;
  isAuthenticated: boolean;
  alreadyFollowing: boolean;
  followingArtists: ArtistTileData[];
  collectedWorks: CollectedWorkTile[];
  showCollection: boolean;
  /** Migration 170 — mask identity for visitors: neutral cover, "Private
   *  supporter" name, no bio/links/collection. Following stays public. */
  privateSupporter?: boolean;
}

export function PatronProfileView({
  profile, displayName, isOwner, canMessage, isAuthenticated, alreadyFollowing,
  followingArtists, collectedWorks, showCollection, privateSupporter = false,
}: PatronProps) {
  const cover = !privateSupporter && profile.featured_image_url
    ? profile.featured_image_url
    : null;
  const loc = privateSupporter ? "" : [profile.city, profile.country].filter(Boolean).join(", ");
  const since = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-NZ", { month: "long", year: "numeric" })
    : null;
  // Two-line name treatment, matching the artist cover
  const nameParts = privateSupporter ? ["Private", "supporter"] : displayName.split(/\s+/);
  const line1 = nameParts[0];
  const line2 = nameParts.slice(1).join(" ");

  return (
    <div>
      {/* ── Cover ── */}
      <div className="relative h-[300px] w-full overflow-hidden sm:h-[380px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${displayName} cover`}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: `center ${profile.banner_focus_y ?? 50}%` }}
          />
        ) : privateSupporter ? (
          <div className="absolute inset-0 bg-muted" />
        ) : (
          <div className="absolute inset-0" style={{ background: getBannerGradient(profile.username) }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.05) 40%, rgba(0,0,0,.65) 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-9 sm:px-12">
          <div className="mx-auto max-w-[1280px]">
            <h1 className="mb-3 text-[40px] font-semibold leading-[0.94] tracking-[-0.045em] text-white sm:text-[60px]">
              {line1}
              {line2 && (
                <>
                  <br />
                  {line2}
                </>
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-3.5">
              {loc && <span className="font-mono text-xs text-white/55">{loc}</span>}
              {loc && <span aria-hidden="true" className="font-mono text-xs text-white/25">·</span>}
              <span className="font-mono text-xs text-white/55">Patron</span>
              {since && (
                <>
                  <span aria-hidden="true" className="font-mono text-xs text-white/25">·</span>
                  <span className="font-mono text-xs text-[rgba(115,230,190,.9)]" role="status">
                    <span aria-hidden="true">● </span>supporting since {since}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="border-b border-border bg-background">
        <div className={`${INNER} flex flex-wrap items-center justify-between gap-4 py-4`}>
          <div className="flex flex-wrap items-center gap-1.5">
            {followingArtists.length > 0 && (
              <span className={BADGE_NEUTRAL}>
                {followingArtists.length} artist{followingArtists.length !== 1 ? "s" : ""} followed
              </span>
            )}
            {!privateSupporter && profile.is_patronage_supported && (
              <span className={BADGE_GREEN}>With Patronage</span>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isOwner && (
              <Link
                href="/profile/edit"
                className="inline-flex h-9 items-center border border-border px-4 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              >
                Edit Profile
              </Link>
            )}
            {!isOwner && (
              <FollowButton
                followingId={profile.id}
                initialIsFollowing={alreadyFollowing}
                isAuthenticated={isAuthenticated}
              />
            )}
            {canMessage && <MessageButton otherUserId={profile.id} />}
            {!privateSupporter && (
              <div className="ml-1 flex items-center gap-1.5">
                <IconLinks profile={profile} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bio + taste — hidden entirely in private mode ── */}
      {!privateSupporter && (profile.bio || (profile.medium ?? []).length > 0) && (
        <div className="border-b border-border">
          <div className={`${INNER} grid grid-cols-1 items-start gap-8 py-10 lg:grid-cols-[3fr_2fr] lg:gap-16`}>
            <div>
              {profile.bio && (
                <p className="text-[17px] leading-[1.72] text-[color:var(--fg-muted)] whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}
            </div>
            {(profile.medium ?? []).length > 0 && (
              <div>
                <h2 className={`${SECTION_LABEL} mb-5`}>Taste</h2>
                <div className="flex flex-wrap gap-1">
                  {(profile.medium ?? []).map((m) => (
                    <span
                      key={m}
                      className="border border-border px-1.5 py-0.5 font-mono text-[10px] leading-relaxed text-[color:var(--fg-muted)]"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Following — the relationship stays public ── */}
      {(followingArtists.length > 0 || isOwner) && (
        <div className="border-b border-border bg-feed-bg">
          <div className={`${INNER} py-9`}>
            <h2 className={`${SECTION_LABEL} mb-4`}>
              Following · {followingArtists.length} artist{followingArtists.length !== 1 ? "s" : ""}
            </h2>
            {followingArtists.length > 0 ? (
              <div className="grid grid-cols-2 gap-[2px] sm:grid-cols-3 lg:grid-cols-6">
                {followingArtists.map((a) => (
                  <ArtistTile key={a.id} a={a} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not following anyone yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Collected works — no prices, ever; hidden in private mode ── */}
      {!privateSupporter && showCollection && collectedWorks.length > 0 && (
        <div className="bg-feed-bg">
          <div className={`${INNER} pb-12 pt-9`}>
            <h2 className={`${SECTION_LABEL} mb-4`}>Collected works</h2>
            <div className="grid grid-cols-2 gap-1 md:grid-cols-4">
              {collectedWorks.map((w) => {
                const img = w.url
                  ? w.url
                  : null;
                const tile = (
                  <>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={w.title ?? ""}
                        className="aspect-square w-full object-cover transition-opacity duration-[260ms] group-hover:opacity-[.78]"
                        loading="lazy"
                      />
                    ) : (
                      <div className="aspect-square w-full bg-muted" />
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0 px-3 py-2.5 opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,.8), transparent)" }}
                    >
                      {w.title && <p className="truncate text-xs text-white">{w.title}</p>}
                      {w.artistName && (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-white/60">{w.artistName}</p>
                      )}
                    </div>
                  </>
                );
                return w.href ? (
                  <Link key={w.id} href={w.href} className="group relative block overflow-hidden">
                    {tile}
                  </Link>
                ) : (
                  <div key={w.id} className="group relative overflow-hidden">
                    {tile}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
