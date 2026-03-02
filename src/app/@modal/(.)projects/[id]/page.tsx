import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUpdateById } from "@/lib/feed";
import { getVisibleNotes } from "@/lib/notes";
import { getProfileById } from "@/lib/profiles";
import { NotesSection } from "@/components/projects/NotesSection";
import { ModalShell } from "@/components/projects/ModalShell";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectModal({ params }: Props) {
  const { id } = await params;

  const [update, notes] = await Promise.all([getUpdateById(id), getVisibleNotes(id)]);
  if (!update) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserProfile = user ? await getProfileById(user.id) : null;
  const currentUserName = currentUserProfile?.full_name ?? currentUserProfile?.username;
  const currentUserUsername = currentUserProfile?.username;
  const currentUserAvatarUrl = currentUserProfile?.avatar_url ?? null;
  const canNote = !!user;

  const name = update.artist_full_name ?? update.artist_username;
  const date = new Date(update.created_at).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <ModalShell>
      <div className="space-y-8">
        {/* Image */}
        <div className="border border-black overflow-hidden bg-muted">
          <Image
            src={update.image_url}
            alt={update.caption ?? `Studio update by ${name}`}
            width={1200}
            height={900}
            priority
            unoptimized
            className="w-full h-auto max-h-[70vh] object-contain"
          />
        </div>

        {/* Meta */}
        <div className="space-y-4">
          {update.caption && (
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

        {/* Notes */}
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
    </ModalShell>
  );
}
