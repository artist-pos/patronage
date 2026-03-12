import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { WorkDetailViewer } from "@/components/profile/WorkDetailViewer";
import { WorkDetailActions } from "@/components/profile/WorkDetailActions";
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
  };

  const WORK_SELECT = "id, url, caption, description, title, year, medium, dimensions, linked_artwork_id, hide_from_archive, content_type";

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
          .select("id, price, price_currency, is_available, hide_available, hide_price, current_owner_id, creator_id, edition")
          .eq("id", work.linked_artwork_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.auth.getUser(),
  ]);

  return {
    profile,
    work,
    galleryImages: (galleryResult.data ?? []) as WorkImage[],
    artwork: artworkResult.data ?? null,
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

  const { profile, work, galleryImages, artwork, viewer } = result;
  const isOwner = viewer?.id === profile.id;

  if (work.hide_from_archive && !isOwner) notFound();

  const artistName = profile.full_name ?? profile.username;
  const displayTitle = work.title ?? work.caption ?? "Untitled";

  const isAvailable = !!artwork && artwork.is_available && !artwork.hide_available;
  const isSold =
    !!artwork && !artwork.is_available &&
    !!artwork.current_owner_id && artwork.current_owner_id !== artwork.creator_id;

  const metaLine = [
    work.year ? String(work.year) : null,
    work.medium,
    work.dimensions,
    artwork?.edition ? `Ed. ${artwork.edition}` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-center gap-3 text-sm text-muted-foreground">
        <Link href={`/${username}?tab=work`} className="hover:text-foreground transition-colors">
          ← {artistName}
        </Link>
        {isOwner && (
          <>
            <span className="text-border">·</span>
            <Link href="/dashboard/works" className="hover:text-foreground transition-colors">My Works</Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-10 items-start">
        {/* Left — image viewer */}
        <WorkDetailViewer primaryUrl={work.url} galleryImages={galleryImages} caption={displayTitle} />

        {/* Right — sticky sidebar */}
        <div className="md:sticky md:top-6 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold leading-snug">{displayTitle}</h1>
            {metaLine && <p className="text-sm text-muted-foreground">{metaLine}</p>}
          </div>

          {isAvailable && !isOwner && (
            <WorkDetailActions
              artistId={profile.id}
              artistName={artistName}
              artworkId={artwork!.id}
              workTitle={work.title ?? work.caption}
              workDescription={work.description}
              price={artwork!.price}
              priceCurrency={(artwork!.price_currency as "NZD" | "AUD") ?? "NZD"}
              hidePrice={artwork!.hide_price}
            />
          )}

          {isAvailable && isOwner && (
            <div className="py-3 border-t border-border border-b">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Listed for sale
                {artwork?.price && artwork.price !== "POA" && !artwork.hide_price
                  ? ` · ${artwork.price_currency} ${parseFloat(artwork.price).toLocaleString("en-NZ")}`
                  : artwork?.price === "POA" ? " · POA" : ""}
              </p>
            </div>
          )}

          {isSold && (
            <div className="py-3 border-t border-border border-b space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Provenance
              </p>
              <p className="text-xs text-muted-foreground">Created by {artistName}</p>
              <p className="text-xs text-muted-foreground">Transferred to a private collector</p>
            </div>
          )}

          {work.description && (
            <div className={!isAvailable && !isSold ? "pt-3 border-t border-border" : ""}>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {work.description}
              </p>
            </div>
          )}

          {isAvailable && !viewer && (
            <p className="text-xs text-muted-foreground">
              <Link href="/auth/login" className="underline underline-offset-2">Sign in</Link>{" "}
              to enquire about this work.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
