import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { WorkDetailViewer } from "@/components/profile/WorkDetailViewer";
import { AvailableWorkPill } from "@/components/profile/AvailableWorkPill";
import { WorkEngagementTracker } from "@/components/profile/WorkEngagementTracker";
import { ProjectThread } from "@/components/works/ProjectThread";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import type { WorkImage } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  params: Promise<{ username: string; slug: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type WorkRow = {
  id: string; url: string | null; caption: string | null; description: string | null;
  title: string | null; year: number | null; medium: string | null;
  dimensions: string | null; hide_from_archive: boolean; content_type: string;
  audio_url: string | null; video_url: string | null;
  text_content: string | null; embed_url: string | null; embed_provider: string | null;
  price_cents: number | null; is_poa: boolean | null; price_currency: string | null;
  is_available: boolean; hide_available: boolean | null; hide_price: boolean | null;
  current_owner_id: string | null; creator_id: string; listing_mode: string | null;
  acquisition_mode: string | null; ledger_id: string | null; slug: string | null;
};

const WORK_SELECT = "id, url, caption, description, title, year, medium, dimensions, hide_from_archive, content_type, audio_url, video_url, text_content, embed_url, embed_provider, price_cents, is_poa, price_currency, is_available, hide_available, hide_price, current_owner_id, creator_id, listing_mode, acquisition_mode, ledger_id, slug";

async function getWorkData(username: string, slug: string) {
  const supabase = await createClient();
  const profile = await getProfile(username);
  if (!profile) return null;

  const isUUID = UUID_RE.test(slug);

  let work: WorkRow | null = null;

  if (!isUUID) {
    const { data } = await supabase.from("artworks").select(WORK_SELECT)
      .eq("slug", slug).eq("profile_id", profile.id).maybeSingle();
    work = data;
  }
  if (!work && isUUID) {
    const { data } = await supabase.from("artworks").select(WORK_SELECT)
      .eq("id", slug).eq("profile_id", profile.id).maybeSingle();
    work = data;
  }

  if (!work) return null;

  const [galleryResult, authResult, editionsResult] = await Promise.all([
    supabase.from("work_images").select("*").eq("artwork_id", work.id).order("position", { ascending: true }),
    supabase.auth.getUser(),
    supabase.from("editions").select("id, label, type, price_cents, currency, poa, listing_mode, listed, dimensions, sort_order").eq("work_id", work.id).eq("listed", true).order("sort_order", { ascending: true }),
  ]);

  const [projectResult, selectedEntryResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, description, opportunity_id, opportunity:opportunity_id(title, organiser, type)")
      .eq("artwork_id", work.id)
      .maybeSingle(),
    supabase
      .from("artwork_provenance_ledger")
      .select("entry_type")
      .eq("artwork_id", work.id)
      .eq("entry_type", "selected")
      .maybeSingle(),
  ]);

  const project = projectResult.data ?? null;
  const selectedEntry = selectedEntryResult.data ?? null;

  const [updatesResult, campaignResult] = await Promise.all([
    project
      ? supabase
          .from("project_updates")
          .select("id, title, caption, update_tag, image_url, created_at")
          .eq("project_id", (project as { id: string }).id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    supabase
      .from("campaigns")
      .select("id, title, campaign_type, slug, landing_page_slug, status, updated_at")
      .eq("hero_work_id", work.id)
      .eq("status", "live")
      .maybeSingle(),
  ]);

  const updates = updatesResult.data ?? [];
  const linkedCampaign = campaignResult.data ?? null;

  const editions = (editionsResult.data ?? []).map(e => ({
    id: e.id,
    label: e.label,
    type: e.type,
    price_cents: e.price_cents ?? null,
    currency: (e.currency ?? "NZD") as string,
    poa: e.poa ?? false,
    listing_mode: e.listing_mode ?? "enquire",
    listed: e.listed ?? false,
    dimensions: e.dimensions ?? null,
    sort_order: e.sort_order ?? 0,
  }));

  return {
    profile,
    work,
    galleryImages: (galleryResult.data ?? []) as WorkImage[],
    editions,
    project,
    updates,
    selectedEntry,
    linkedCampaign,
    viewer: authResult.data.user,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, slug } = await params;
  const result = await getWorkData(username, slug);
  if (!result) return { title: "Work not found — Patronage" };
  const { profile, work } = result;
  const artistName = profile.full_name ?? profile.username;
  const title = work.title ?? work.caption ?? "Untitled";
  return {
    title: `${title} — ${artistName} | Patronage`,
    description: work.description ? work.description.slice(0, 155) : `${title} by ${artistName}.`,
    openGraph: { images: work.url ? [{ url: work.url }] : [] },
  };
}

export default async function WorkDetailPage({ params }: Props) {
  const { username, slug } = await params;
  const result = await getWorkData(username, slug);
  if (!result) notFound();

  const { profile, work, galleryImages, editions, project, updates, selectedEntry, linkedCampaign, viewer } = result;
  const isOwner = viewer?.id === profile.id;

  if (work.hide_from_archive && !isOwner) notFound();

  const artistName = profile.full_name ?? profile.username;
  const displayTitle = work.title ?? work.caption ?? "Untitled";

  const isAvailable = work.is_available && !work.hide_available;
  const isSold =
    !work.is_available &&
    !!work.current_owner_id && work.current_owner_id !== work.creator_id;

  const metaLine = [
    work.year ? String(work.year) : null,
    work.medium,
    work.dimensions,
  ].filter(Boolean).join(" · ");

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {!isOwner && <WorkEngagementTracker workId={work.id} />}
      <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
        <Link href={`/${username}?tab=work`} className="hover:text-foreground transition-colors">
          ← {artistName}
        </Link>
        {isOwner && (
          <>
            <span className="text-border">·</span>
            <Link href="/studio" className="hover:text-foreground transition-colors">Studio</Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-12 items-start">
        {/* Left — media viewer */}
        {work.content_type === "audio" && work.audio_url && (
          <div className="bg-stone-900 text-white flex flex-col items-center justify-center gap-6 p-10 min-h-[320px]">
            {work.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={work.url} alt="" className="w-32 h-32 object-cover rounded" />
            )}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={work.audio_url} className="w-full max-w-md" />
          </div>
        )}
        {work.content_type === "video" && work.video_url && (
          <div className="bg-black flex items-center justify-center min-h-[320px]">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video controls src={work.video_url} className="w-full max-h-[600px]" />
          </div>
        )}
        {(work.content_type === "video" || work.content_type === "embed") && !work.video_url && work.embed_url && (
          <div className="aspect-video bg-black">
            <iframe
              src={work.embed_url}
              className="w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              frameBorder="0"
              title={displayTitle}
            />
          </div>
        )}
        {work.content_type === "text" && work.text_content && (
          <div className="bg-stone-50 p-8 min-h-[320px] overflow-y-auto max-h-[700px]">
            <pre className="font-mono text-sm text-stone-800 leading-relaxed whitespace-pre-wrap">
              {work.text_content}
            </pre>
          </div>
        )}
        {(work.content_type === "image" || (!work.content_type) || (work.content_type === "audio" && !work.audio_url)) && (
          <WorkDetailViewer primaryUrl={work.url ?? ""} galleryImages={galleryImages} caption={displayTitle} />
        )}

        {/* Right — sticky sidebar */}
        <div className="md:sticky md:top-6 space-y-6">
          {/* Title + meta header */}
          <div className="pb-5 border-b border-border">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-2xl font-bold leading-snug">{displayTitle}</h1>
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <ShareTrigger
                  variant="icon"
                  payload={{
                    type: "work",
                    title: displayTitle,
                    sub: work.caption ?? work.medium ?? "",
                    price: null,
                    tag: work.medium ?? "",
                    handle: username,
                    imageUrl: work.url,
                    shareUrl: `${SITE_URL}/${username}/works/${work.slug ?? work.id}`,
                  }}
                />
                {isAvailable && (
                  <AvailableWorkPill
                    artistId={profile.id}
                    artistName={artistName}
                    artworkId={work.id}
                    workTitle={work.title ?? work.caption}
                    workDescription={work.description}
                    priceCents={work.price_cents ?? null}
                    isPoa={work.is_poa ?? false}
                    priceCurrency={(work.price_currency as "NZD" | "AUD") ?? "NZD"}
                    hidePrice={work.hide_price ?? false}
                    listingMode={(work.listing_mode as "direct_sale" | "enquire_first") ?? "enquire_first"}
                    acquisitionMode={(work.acquisition_mode as "buy_now" | "make_offer" | "enquire_first") ?? "enquire_first"}
                    workImageUrl={work.url}
                    year={work.year}
                    medium={work.medium}
                    dimensions={work.dimensions}
                    metaLine={metaLine || null}
                    editions={editions}
                  />
                )}
              </div>
            </div>
            {metaLine && (
              <p className="text-sm text-muted-foreground font-normal">{metaLine}</p>
            )}
          </div>

          {/* Tag row */}
          {(work.medium || selectedEntry) && (
            <div className="flex flex-wrap gap-1.5">
              {work.medium && (
                <span className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs">
                  {work.medium}
                </span>
              )}
              {selectedEntry && (() => {
                const opps = (selectedEntry as unknown as { opportunities?: { type?: string }[] | { type?: string } | null }).opportunities;
                const oppType = Array.isArray(opps) ? opps[0]?.type : opps?.type;
                return oppType ? (
                  <span className="bg-stone-100 text-stone-600 rounded-full px-3 py-1 text-xs">
                    {oppType}
                  </span>
                ) : null;
              })()}
            </div>
          )}

          {isSold && !isOwner && (
            <div className="py-3 border-t border-border border-b">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Sold</p>
            </div>
          )}

          {work.description && (
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {work.description}
            </p>
          )}

          {isAvailable && !viewer && (
            <p className="text-xs text-muted-foreground">
              <Link href="/auth/login" className="underline underline-offset-2">Sign in</Link>{" "}
              to enquire about this work.
            </p>
          )}

          {work.ledger_id && (
            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{work.ledger_id}</span>
              <Link
                href={`/provenance/${work.ledger_id}`}
                className="hover:text-foreground transition-colors"
              >
                Recorded on Patronage →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Project Thread — full-width below the main grid ── */}
      {project && updates.length >= 0 && (
        <div className="mt-10">
          <ProjectThread
            project={{
              title: (project as unknown as { title: string }).title,
              opportunity_id: (project as unknown as { opportunity_id: string | null }).opportunity_id,
              opportunity: (project as unknown as { opportunity?: { title: string; organiser?: string | null; type: string } | null }).opportunity ?? null,
            }}
            updates={(updates as Array<{
              id: string;
              title: string | null;
              caption: string | null;
              update_tag: string;
              image_url: string | null;
              created_at: string;
            }>).map(u => ({
              ...u,
              update_tag: (u.update_tag ?? "update") as "concept" | "update" | "milestone" | "complete",
            }))}
            campaignOutcome={linkedCampaign ? {
              title: (linkedCampaign as unknown as { title: string }).title,
              campaignType: (linkedCampaign as unknown as { campaign_type: string }).campaign_type,
              slug: (linkedCampaign as unknown as { slug: string; landing_page_slug: string | null }).landing_page_slug ?? (linkedCampaign as unknown as { slug: string }).slug,
              artistUsername: profile.username,
              liveDate: (linkedCampaign as unknown as { updated_at: string }).updated_at,
            } : null}
          />
        </div>
      )}
    </div>
  );
}
