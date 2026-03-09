import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getUpdateById } from "@/lib/feed";
import { getVisibleNotes } from "@/lib/notes";
import { getProfileById } from "@/lib/profiles";
import { NotesSection } from "@/components/projects/NotesSection";
import type { ProjectUpdateWithArtist } from "@/types/database";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; u?: string; t?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const update = await getUpdateById(id);
  if (!update) return { title: "Update not found — Patronage" };
  const name = update.artist_full_name ?? update.artist_username;
  const ogImages = update.image_url
    ? [{ url: update.image_url, alt: update.caption ?? name }]
    : [];
  return {
    title: `${name} — Studio Update | Patronage`,
    description: update.caption ?? `Studio update from ${name} on Patronage.`,
    openGraph: { images: ogImages },
  };
}

function UpdateMedia({ update, name }: { update: ProjectUpdateWithArtist; name: string }) {
  const { content_type, image_url, audio_url, video_url, text_content, embed_url, embed_provider } = update;

  if (content_type === "image" && image_url) {
    return (
      <div className="border border-black overflow-hidden bg-muted">
        <Image
          src={image_url}
          alt={update.caption ?? `Studio update by ${name}`}
          width={1200}
          height={900}
          priority
          unoptimized
          className="w-full h-auto max-h-[70vh] object-contain"
        />
      </div>
    );
  }

  if (content_type === "audio") {
    return (
      <div className="border border-black bg-zinc-900 text-white p-8 space-y-4">
        {update.caption && (
          <p className="text-sm font-medium leading-relaxed">{update.caption}</p>
        )}
        {audio_url && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls className="w-full" src={audio_url} />
        )}
        {embed_url && !audio_url && (
          <iframe
            src={embed_url}
            width="100%"
            height="166"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="w-full"
          />
        )}
      </div>
    );
  }

  if (content_type === "video") {
    if (embed_url) {
      return (
        <div className="border border-black bg-black overflow-hidden aspect-video">
          <iframe
            src={embed_url}
            title={update.caption ?? `Video by ${name}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      );
    }
    if (video_url) {
      return (
        <div className="border border-black bg-black overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls className="w-full max-h-[70vh]" src={video_url} />
        </div>
      );
    }
  }

  if (content_type === "embed" && embed_url) {
    return (
      <div className="border border-black overflow-hidden">
        <iframe
          src={embed_url}
          title={update.caption ?? `Embed by ${name}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full"
          style={{ height: 400 }}
        />
      </div>
    );
  }

  if (content_type === "text" && text_content) {
    return (
      <div className="border border-black p-6 sm:p-8 bg-background">
        {update.discipline && (
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            {update.discipline.replace(/_/g, " ")}
          </p>
        )}
        <div className="prose prose-sm max-w-none">
          {text_content.split("\n\n").map((para, i) => (
            <p key={i} className="mb-4 leading-relaxed text-base last:mb-0">
              {para}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { from, u, t } = await searchParams;
  const [update, notes] = await Promise.all([
    getUpdateById(id),
    getVisibleNotes(id),
  ]);
  if (!update) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentUserProfile = user ? await getProfileById(user.id) : null;
  const currentUserName = currentUserProfile?.full_name ?? currentUserProfile?.username;
  const currentUserUsername = currentUserProfile?.username;
  const currentUserAvatarUrl = currentUserProfile?.avatar_url ?? null;

  const backHref =
    from === "thread" && t ? `/threads/${t}` :
    from === "profile" && u ? `/${u}` :
    "/feed";
  const backLabel =
    from === "thread" ? "← Back to thread" :
    from === "profile" && u ? "← Back to profile" :
    "← Back to feed";

  const canNote = !!user;

  const name = update.artist_full_name ?? update.artist_username;
  const date = new Date(update.created_at).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // For text posts the caption is part of the body, not shown separately
  const showCaption = update.content_type !== "text" && update.caption;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">

      <Link href={backHref} scroll={false} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        {backLabel}
      </Link>

      <UpdateMedia update={update} name={name} />

      <div className="space-y-4">
        {showCaption && (
          <p className="text-base leading-relaxed">{update.caption}</p>
        )}

        <div className="flex items-center gap-3">
          {update.artist_avatar_url && (
            <div className="relative w-8 h-8 shrink-0 border border-black overflow-hidden">
              <Image
                src={update.artist_avatar_url}
                alt={name}
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
          )}
          <div>
            <Link
              href={`/${update.artist_username}`}
              className="text-sm font-semibold hover:underline underline-offset-2"
            >
              {name}
            </Link>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
        </div>
      </div>

      {(notes.length > 0 || canNote) && (
        <div className="space-y-6 border-t border-border pt-8">
          <NotesSection
            initialNotes={notes}
            updateId={update.id}
            artistId={update.artist_id}
            currentUserId={user?.id}
            currentUserName={currentUserName}
            currentUserUsername={currentUserUsername}
            currentUserAvatarUrl={currentUserAvatarUrl}
          />
        </div>
      )}

    </div>
  );
}
