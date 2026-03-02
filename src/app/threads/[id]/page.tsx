import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getThread, type ThreadPost } from "@/lib/projects";
import { NotesList } from "@/components/projects/NotesList";
import { AddNoteForm } from "@/components/projects/AddNoteForm";

interface Props {
  params: Promise<{ id: string }>;
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

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = !!user && user.id === thread.project.artist_id;
  const canNote = !!user; // any authenticated user, including artist (for context/specs)

  const { project, posts } = thread;
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
        <h1 className="text-3xl font-bold tracking-tight">{project.title}</h1>

        {project.description && (
          <p className="text-base leading-relaxed text-muted-foreground">
            {project.description}
          </p>
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
              canNote={canNote}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadPostItem({
  post,
  isFirst,
  canNote,
  currentUserId,
}: {
  post: ThreadPost;
  isFirst: boolean;
  canNote: boolean;
  currentUserId?: string;
}) {
  return (
    <div className="relative pl-10 pb-12">
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
        {/* Timestamp */}
        <p className="text-[11px] font-mono text-muted-foreground pt-1">
          {formatTimestamp(post.created_at)}
        </p>

        {/* Image */}
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

        {/* Caption */}
        {post.caption && (
          <p className="text-sm leading-relaxed">{post.caption}</p>
        )}

        {/* Notes */}
        {(post.notes.length > 0 || canNote) && (
          <div className="space-y-4 border-t border-border pt-4">
            <NotesList notes={post.notes} currentUserId={currentUserId} />
            {canNote && (
              <AddNoteForm updateId={post.id} artistId={post.artist_id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
