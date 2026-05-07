import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getThread, type ThreadPost } from "@/lib/projects";
import { getProfileById } from "@/lib/profiles";
import { ModalShell } from "@/components/projects/ModalShell";
import { NotesSection } from "@/components/projects/NotesSection";
import { PatronageArticleCard } from "@/components/projects/PatronageArticleCard";
import type { CollaboratorProfile } from "@/types/database";

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

export default async function ThreadModal({ params }: Props) {
  const { id } = await params;
  const thread = await getThread(id);
  if (!thread) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserProfile = user ? await getProfileById(user.id) : null;
  const currentUserName = currentUserProfile?.full_name ?? currentUserProfile?.username;
  const currentUserUsername = currentUserProfile?.username;
  const currentUserAvatarUrl = currentUserProfile?.avatar_url ?? null;
  const canNote = !!user;

  const { project, posts } = thread;
  const artistName = project.artist_full_name ?? project.artist_username;

  return (
    <ModalShell>
      <div className="space-y-6">
        {/* Thread header */}
        <div className="space-y-3 border-b border-border pb-6">
          <h2 className="text-xl font-bold tracking-tight">{project.title}</h2>
          {project.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{project.description}</p>
          )}
          <div className="flex items-center gap-2.5">
            {project.artist_avatar_url && (
              <div className="relative w-7 h-7 shrink-0 border border-black overflow-hidden">
                <Image
                  src={project.artist_avatar_url}
                  alt={artistName}
                  fill
                  className="object-cover"
                  sizes="28px"
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
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" aria-hidden />
            {posts.map((post, i) => (
              <ModalThreadPost
                key={post.id}
                post={post}
                isFirst={i === 0}
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
    </ModalShell>
  );
}

function ModalThreadPost({
  post,
  isFirst,
  canNote,
  currentUserId,
  currentUserName,
  currentUserUsername,
  currentUserAvatarUrl,
}: {
  post: ThreadPost;
  isFirst: boolean;
  canNote: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserUsername?: string;
  currentUserAvatarUrl?: string | null;
}) {
  return (
    <div className="relative pl-10 pb-10">
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

      <div className="space-y-3">
        <p className="text-[11px] font-mono text-muted-foreground pt-1">
          {formatTimestamp(post.created_at)}
        </p>

        {post.image_url && (
          <div className="border border-black overflow-hidden bg-muted">
            <Image
              src={post.image_url}
              alt={post.caption ?? "Studio update"}
              width={800}
              height={600}
              unoptimized
              className="w-full h-auto"
            />
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

        {post.caption && (
          <p className="text-sm leading-relaxed">{post.caption}</p>
        )}

        {post.collaborators && post.collaborators.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Featuring</span>
            {post.collaborators.map((c: CollaboratorProfile) => {
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

        {post.embed_provider === "Patronage" && post.embed_url && (
          <PatronageArticleCard articleUrl={post.embed_url} />
        )}

        {(post.notes.length > 0 || canNote) && (
          <div className="space-y-3 border-t border-border pt-3">
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
