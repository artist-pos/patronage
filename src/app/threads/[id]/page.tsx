import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getThread, type ThreadPost } from "@/lib/projects";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import { EditUpdateModal } from "@/components/projects/EditUpdateModal";
import { EditProjectHeader } from "@/components/projects/EditProjectHeader";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { getProfileById } from "@/lib/profiles";
import { NotesSection } from "@/components/projects/NotesSection";
import { PatronageArticleCard } from "@/components/projects/PatronageArticleCard";
import { ThreadScrollTo } from "@/components/projects/ThreadScrollTo";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scroll?: string }>;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const mon = d.toLocaleString("en-NZ", { month: "short" });
  return `${hh}:${mm}, ${dd} ${mon}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) return { title: "Project not found — Patronage" };
  const name = thread.project.artist_full_name ?? thread.project.artist_username;
  return {
    title: `${thread.project.title} — ${name} | Patronage`,
    description: thread.project.description ?? `Project thread by ${name} on Patronage.`,
  };
}

export default async function ThreadPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { scroll } = await searchParams;
  const thread = await getThread(id);
  if (!thread) notFound();

  // Redirect UUID access to slug URL, preserving ?scroll= so the target post stays visible
  if (UUID_RE.test(id) && thread.project.slug) {
    const destination = `/threads/${thread.project.slug}${scroll ? `?scroll=${scroll}` : ""}`;
    redirect(destination);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const currentUserProfile = user ? await getProfileById(user.id) : null;
  const currentUserName = currentUserProfile?.full_name ?? currentUserProfile?.username;
  const currentUserUsername = currentUserProfile?.username;
  const currentUserAvatarUrl = currentUserProfile?.avatar_url ?? null;
  const isAdmin = currentUserProfile?.role === "admin" || currentUserProfile?.role === "owner";
  const canNote = !!user;

  const { project, posts } = thread;
  const isOwner = currentUserProfile?.id === project.artist_id;
  const artistName = project.artist_full_name ?? project.artist_username;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-10">

      {/* Back */}
      <Link
        href={`/${project.artist_username}`}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to {artistName}
      </Link>

      {/* Project header */}
      <div className="space-y-4 border-b border-border pb-10">
        {isOwner ? (
          <EditProjectHeader
            projectId={project.id}
            initialTitle={project.title}
            initialDescription={project.description ?? null}
          />
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>
            {project.description && (
              <p className="text-base leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            )}
          </>
        )}

        {/* Artist identity */}
        <div className="flex items-center gap-3 pt-2">
          {project.artist_avatar_url && (
            <div className="relative w-8 h-8 shrink-0 border border-black overflow-hidden">
              <Image
                src={project.artist_avatar_url}
                alt={artistName}
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
          )}
          <div>
            <Link
              href={`/${project.artist_username}`}
              className="text-sm font-semibold hover:underline underline-offset-2"
            >
              {artistName}
            </Link>
            <p className="text-xs text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </p>
          </div>
        </div>
      </div>

      {scroll && <ThreadScrollTo postId={scroll} />}

      {/* Timeline */}
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts in this thread yet.</p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical timeline line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" aria-hidden />

          {posts.map((post, i) => (
            <ThreadPostItem
              key={post.id}
              post={post}
              isFirst={i === 0}
              projectSlug={thread.project.slug ?? thread.project.id}
              artistName={artistName}
              isAdmin={isAdmin}
              canNote={canNote}
              currentUserId={user?.id}
              currentUserName={currentUserName}
              currentUserUsername={currentUserUsername}
              currentUserAvatarUrl={currentUserAvatarUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function ThreadPostItem({
  post,
  isFirst,
  projectSlug,
  artistName,
  isAdmin,
  canNote,
  currentUserId,
  currentUserName,
  currentUserUsername,
  currentUserAvatarUrl,
}: {
  post: ThreadPost;
  isFirst: boolean;
  projectSlug: string;
  artistName: string;
  isAdmin: boolean;
  canNote: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserUsername?: string;
  currentUserAvatarUrl?: string | null;
}) {
  return (
    <div id={`post-${post.id}`} className="relative pl-10 pb-12 scroll-mt-20">
      {/* Timeline dot */}
      <div
        className={`absolute left-0 top-1 w-7 h-7 border border-black flex items-center justify-center bg-background z-10 ${isFirst ? "bg-foreground" : ""}`}
        aria-hidden
      >
        {post.artist_avatar_url ? (
          <Image
            src={post.artist_avatar_url}
            alt=""
            width={28}
            height={28}
            className="object-cover w-full h-full"
          />
        ) : null}
      </div>

      {/* Post content */}
      <div className="space-y-4">
        {/* Timestamp + admin edit + share */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] font-mono text-muted-foreground">
            {formatTimestamp(post.created_at)}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <EditUpdateModal
                updateId={post.id}
                initialTitle={post.title}
                initialTldr={post.tldr ?? null}
              />
            )}
            <ShareTrigger
              variant="icon"
              className="w-6 h-6 flex items-center justify-center hover:bg-muted rounded transition-colors text-muted-foreground shrink-0"
              payload={{
                type: "update",
                title: post.title ?? post.caption?.slice(0, 60) ?? "Studio Update",
                sub: post.tldr ?? `${artistName} · ${formatTimestamp(post.created_at)}`,
                price: null,
                tag: "STUDIO UPDATE",
                handle: `@${post.artist_username}`,
                imageUrl: post.image_url ?? null,
                shareUrl: `${SITE_URL}/threads/${projectSlug}?scroll=${post.id}`,
              }}
            />
          </div>
        </div>

        {/* Media */}
        {post.image_url && (
          <div className="border border-black overflow-hidden bg-muted">
            <Link href={`/projects/${post.id}?from=thread&t=${post.project_id}`}>
              <Image
                src={post.image_url}
                alt={post.caption ?? "Studio update"}
                width={800}
                height={600}
                unoptimized
                className="w-full h-auto"
              />
            </Link>
          </div>
        )}
        {post.content_type === "audio" && post.audio_url && (
          <div className="border border-black bg-zinc-900 p-4">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls className="w-full" src={post.audio_url} />
          </div>
        )}
        {post.content_type === "text" && post.text_content && (
          <div className="border border-black p-4 bg-background">
            {post.text_content.split("\n\n").map((para, i) => (
              <p key={i} className="mb-3 text-sm leading-relaxed last:mb-0">{para}</p>
            ))}
          </div>
        )}
        {post.content_type === "video" && (
          post.embed_url ? (
            <div className="border border-black bg-black overflow-hidden aspect-video">
              <iframe
                src={post.embed_url}
                title={post.caption ?? `Video by ${artistName}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          ) : post.video_url ? (
            <div className="border border-black bg-black overflow-hidden">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls className="w-full max-h-[70vh]" src={post.video_url} />
            </div>
          ) : null
        )}
        {post.content_type === "embed" && post.embed_url && post.embed_provider !== "Patronage" && (
          <div className="space-y-2">
            <a
              href={post.embed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {post.embed_provider ?? post.embed_url} ↗
            </a>
            <div className="border border-black overflow-hidden">
              <iframe
                src={post.embed_url}
                title={post.caption ?? `Embed by ${artistName}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full"
                style={{ height: 400 }}
              />
            </div>
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <p className="text-base leading-relaxed">{post.caption}</p>
        )}

        {/* Collaborator credits */}
        {post.collaborators && post.collaborators.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Featuring</span>
            {post.collaborators.map(c => {
              const cName = c.full_name ?? c.username;
              return (
                <Link
                  key={c.id}
                  href={`/${c.username}`}
                  className="flex items-center gap-1.5 text-xs font-medium hover:underline underline-offset-2"
                >
                  {c.avatar_url ? (
                    <div className="relative w-5 h-5 shrink-0 border border-black overflow-hidden">
                      <Image src={c.avatar_url} alt={cName} fill className="object-cover" sizes="20px" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 shrink-0 border border-black bg-muted flex items-center justify-center text-[8px] font-semibold">
                      {cName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {cName}
                </Link>
              );
            })}
          </div>
        )}

        {/* Blog + Instagram card */}
        {post.embed_provider === "Patronage" && post.embed_url && (
          <PatronageArticleCard articleUrl={post.embed_url} />
        )}

        {/* Notes */}
        {(post.notes.length > 0 || canNote) && (
          <div className="space-y-4 border-t border-border pt-4">
            <NotesSection
              initialNotes={post.notes}
              updateId={post.id}
              artistId={post.artist_id}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserUsername={currentUserUsername}
              currentUserAvatarUrl={currentUserAvatarUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
