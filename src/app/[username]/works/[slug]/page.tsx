import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { WorkDetailViewer } from "@/components/profile/WorkDetailViewer";
import { WorkDetailActions } from "@/components/profile/WorkDetailActions";
import { WorkEngagementTracker } from "@/components/profile/WorkEngagementTracker";
import { ProjectThread } from "@/components/works/ProjectThread";
import type { WorkImage } from "@/types/database";

interface Props {
  params: Promise<{ username: string; slug: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getWorkData(username: string, slug: string) {
  const supabase = await createClient();
  const profile = await getProfile(username);
  if (!profile) return null;

  const isUUID = UUID_RE.test(slug);

  type WorkRow = {
    id: string; url: string; caption: string | null; description: string | null;
    title: string | null; year: number | null; medium: string | null;
    dimensions: string | null; linked_artwork_id: string | null;
    hide_from_archive: boolean; content_type: string;
    audio_url: string | null; video_url: string | null;
    text_content: string | null; embed_url: string | null; embed_provider: string | null;
  };

  const WORK_SELECT = "id, url, caption, description, title, year, medium, dimensions, linked_artwork_id, hide_from_archive, content_type, audio_url, video_url, text_content, embed_url, embed_provider";

  let work: WorkRow | null = null;

  if (!isUUID) {
    const { data } = await supabase.from("portfolio_images").select(WORK_SELECT)
      .eq("slug", slug).eq("profile_id", profile.id).maybeSingle();
    work = data;
  }
  if (!work && isUUID) {
    const { data } = await supabase.from("portfolio_images").select(WORK_SELECT)
      .eq("id", slug).eq("profile_id", profile.id).maybeSingle();
    work = data;
  }
  if (!work && isUUID) {
    const { data } = await supabase.from("portfolio_images").select(WORK_SELECT)
      .eq("linked_artwork_id", slug).eq("profile_id", profile.id).maybeSingle();
    work = data;
  }

  if (!work) return null;

  const [galleryResult, artworkResult, authResult] = await Promise.all([
    supabase.from("work_images").select("*").eq("portfolio_image_id", work.id).order("position", { ascending: true }),
    work.linked_artwork_id
      ? supabase.from("artworks")
          .select("id, url, price_cents, is_poa, price_currency, is_available, hide_available, hide_price, hide_from_archive, current_owner_id, creator_id, year, medium, dimensions, edition, listing_mode, ledger_id")
          .eq("id", work.linked_artwork_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ]);

  const artworkId = artworkResult.data?.id ?? null;

  // Fetch project thread and selected provenance entry concurrently (both independent)
  const [projectResult, selectedEntryResult] = artworkId
    ? await Promise.all([
        supabase
          .from("projects")
          .select("id, title, description")
          .eq("artwork_id", artworkId)
          .maybeSingle(),
        supabase
          .from("artwork_provenance_ledger")
          .select("entry_type")
          .eq("artwork_id", artworkId)
          .eq("entry_type", "selected")
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  const project = projectResult.data ?? null;
  const selectedEntry = selectedEntryResult.data ?? null;

  // Updates depend on project.id — fetch after project resolves
  const updates = project
    ? ((await supabase
        .from("project_updates")
        .select("id, caption, image_url, created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: true })
      ).data ?? [])
    : [];

  return {
    profile,
    work,
    galleryImages: (galleryResult.data ?? []) as WorkImage[],
    artwork: artworkResult.data ?? null,
    project,
    updates,
    selectedEntry,
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

  const { profile, work, galleryImages, artwork, project, updates, selectedEntry, viewer } = result;
  const isOwner = viewer?.id === profile.id;

  if (work.hide_from_archive && !isOwner) notFound();

  const artistName = profile.full_name ?? profile.username;
  const displayTitle = work.title ?? work.caption ?? "Untitled";

  const isAvailable = !!artwork && artwork.is_available && !artwork.hide_available;
  const isSold =
    !!artwork && !artwork.is_available &&
    !!artwork.current_owner_id && artwork.current_owner_id !== artwork.creator_id;

  const artworkPriceCents = artwork?.price_cents ?? null;
  const artworkIsPoa = artwork?.is_poa ?? false;

  const metaLine = [
    work.year ? String(work.year) : null,
    work.medium,
    work.dimensions,
    artwork?.edition ? `Ed. ${artwork.edition}` : null,
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
          <WorkDetailViewer primaryUrl={work.url} galleryImages={galleryImages} caption={displayTitle} />
        )}

        {/* Right — sticky sidebar */}
        <div className="md:sticky md:top-6 space-y-6">
          {/* Title + meta header */}
          <div className="space-y-2 pb-5 border-b border-border">
            <h1 className="text-2xl font-bold leading-snug">{displayTitle}</h1>
            {metaLine && (
              <p className="text-sm text-muted-foreground font-normal">{metaLine}</p>
            )}
          </div>

          {/* Tag row — medium + opportunity type tags */}
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

          {isAvailable && !isOwner && (
            <WorkDetailActions
              artistId={profile.id}
              artistName={artistName}
              artworkId={artwork!.id}
              workTitle={work.title ?? work.caption}
              workDescription={work.description}
              priceCents={artworkPriceCents}
              isPoa={artworkIsPoa}
              priceCurrency={(artwork!.price_currency as "NZD" | "AUD") ?? "NZD"}
              hidePrice={artwork!.hide_price}
              listingMode={(artwork!.listing_mode as "direct_sale" | "enquire_first") ?? "enquire_first"}
              acquisitionMode="enquire_first"
              workImageUrl={artwork!.url ?? work.url}
              year={work.year}
              medium={work.medium}
              dimensions={work.dimensions}
              edition={artwork!.edition}
            />
          )}

          {isAvailable && isOwner && (
            <div className="py-3 border-t border-border border-b">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {artwork?.hide_price
                  ? "Listed for sale"
                  : artworkIsPoa
                    ? "Listed for sale · Price on application"
                    : artworkPriceCents
                      ? `Listed for sale · ${artwork!.price_currency} ${(artworkPriceCents / 100).toLocaleString("en-NZ")}`
                      : "Listed for sale"}
              </p>
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

          {/* Project thread — only shown when a project is linked to this artwork */}
          {project && (
            <ProjectThread
              project={{
                title: (project as unknown as { title: string }).title,
                opportunity_id: (project as unknown as { opportunity_id: string | null }).opportunity_id,
                opportunity: (() => {
                  const opps = (project as unknown as { opportunities?: { title: string; type: string }[] | { title: string; type: string } | null }).opportunities;
                  if (!opps) return null;
                  return Array.isArray(opps) ? (opps[0] ?? null) : opps;
                })(),
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
            />
          )}

          {/* Provenance row — always visible when artwork has a ledger ID */}
          {artwork?.ledger_id && (
            <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-mono">{artwork.ledger_id}</span>
              <Link
                href={`/provenance/${artwork.ledger_id}`}
                className="hover:text-foreground transition-colors"
              >
                Recorded on Patronage →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
