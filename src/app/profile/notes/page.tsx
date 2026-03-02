import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAllArtistNotes } from "@/lib/notes";
import { NoteToggle } from "@/components/profile/NoteToggle";

export const metadata: Metadata = { title: "Manage Notes — Patronage" };

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const notes = await getAllArtistNotes(user.id);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Manage Notes</h1>
        <p className="text-sm text-muted-foreground">
          Notes left by others on your studio updates. Toggle visibility to hide or restore them on your public pages.
        </p>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`flex items-start gap-4 p-4 border ${note.is_visible ? "border-border" : "border-border opacity-50"}`}
            >
              {/* Update thumbnail */}
              {note.update_image_url && (
                <Link href={`/projects/${note.update_id}`} className="shrink-0">
                  <div className="relative w-14 h-14 border border-black overflow-hidden bg-muted">
                    <Image
                      src={note.update_image_url}
                      alt="Update"
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                </Link>
              )}

              {/* Note content */}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">From {note.sender_name}: </span>
                  <span className={note.is_visible ? "" : "line-through text-muted-foreground"}>
                    {note.content}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {new Date(note.created_at).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              {/* Visibility toggle */}
              <NoteToggle noteId={note.id} initialVisible={note.is_visible} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
