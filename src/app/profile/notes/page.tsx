import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getMyWrittenNotes } from "@/lib/notes";
import { ManageNotesList } from "@/components/profile/ManageNotesList";

export const metadata: Metadata = { title: "Manage Notes — Patronage" };

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const notes = await getMyWrittenNotes(user.id);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Manage Notes</h1>
        <p className="text-sm text-muted-foreground">
          Notes you've left on studio updates across the platform.
        </p>
      </div>

      <ManageNotesList initialNotes={notes} />
    </div>
  );
}
