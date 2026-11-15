"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification, mentionedProfileIds, withoutMuted } from "@/lib/notifications";

/** Where a note on this update lives: its project thread, else its own page. */
function noteLink(updateId: string, projectId: string | null): string {
  return projectId ? `/threads/${projectId}?scroll=${updateId}` : `/projects/${updateId}#notes`;
}

function revalidateUpdate(updateId: string, projectId: string | null) {
  revalidatePath(`/projects/${updateId}`);
  if (projectId) revalidatePath(`/threads/${projectId}`);
}

/** Turns the database guard's refusals (227) into sentences people can act on. */
function friendlyNoteError(message: string): string {
  if (message.includes("notes are off")) return "The artist has turned notes off for this update.";
  if (message.includes("under-18")) return "Notes aren't available on under-18 accounts.";
  return "We couldn't post that note. Try again.";
}

/**
 * Post a note, or a reply to one (`parentId`). Notifies, once each and never
 * the writer: the artist, the person replied to, and anyone named with
 * @username. Muted threads are skipped.
 */
export async function addNote(
  updateId: string,
  artistId: string,
  content: string,
  parentId?: string | null,
): Promise<{ id: string; created_at: string; parent_id: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to leave a note.");
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Write something first.");

  // is_visible: true is explicit so RLS SELECT policies that filter on is_visible
  // don't cause the read-back to return 0 rows and throw with .single()
  const { data, error } = await supabase
    .from("project_notes")
    .insert({
      update_id: updateId,
      artist_id: artistId,
      sender_id: user.id,
      content: trimmed,
      is_visible: true,
      parent_id: parentId ?? null,
    })
    .select("id, created_at, parent_id")
    .maybeSingle(); // maybeSingle never throws on 0 rows — data is just null

  if (error) throw new Error(friendlyNoteError(error.message));

  const [{ data: updateRow }, { data: sender }, parent] = await Promise.all([
    supabase.from("project_updates").select("project_id").eq("id", updateId).single(),
    supabase.from("profiles").select("full_name, username").eq("id", user.id).single(),
    parentId
      ? supabase.from("project_notes").select("sender_id, parent_id").eq("id", parentId).maybeSingle().then((r) => r.data)
      : Promise.resolve(null),
  ]);
  const projectId = updateRow?.project_id ?? null;
  revalidateUpdate(updateId, projectId);

  const senderName = sender?.full_name ?? sender?.username ?? "Someone";
  const link = noteLink(updateId, projectId);
  const snippet = trimmed.slice(0, 100);

  // Who hears about it, each at most once, writer excluded.
  const told = new Set<string>([user.id]);
  const repliedTo = parent?.sender_id && !told.has(parent.sender_id) ? parent.sender_id : null;
  if (repliedTo) told.add(repliedTo);
  const artist = !told.has(artistId) ? artistId : null;
  if (artist) told.add(artistId);
  const mentioned = (await mentionedProfileIds(trimmed)).filter((id) => !told.has(id));

  const audience = await withoutMuted(
    [repliedTo, artist, ...mentioned].filter((id): id is string => !!id),
    "update_note_mutes",
    updateId,
  );
  const send = (id: string, type: "note" | "note_reply", title: string) =>
    audience.includes(id) ? createNotification(id, type, title, snippet, link).catch(() => {}) : Promise.resolve();

  await Promise.all([
    repliedTo ? send(repliedTo, "note_reply", `${senderName} replied to your note`) : null,
    artist
      ? send(artist, parentId ? "note_reply" : "note", parentId ? `${senderName} replied in the notes on your update` : `${senderName} left a note`)
      : null,
    ...mentioned.map((id) => send(id, "note", `${senderName} mentioned you in a note`)),
  ]);

  // If RLS filtered the read-back, return a stable fallback so the optimistic
  // note is never removed from the UI (it IS in the DB at this point)
  return data ?? { id: `note-${user.id}-${Date.now()}`, created_at: new Date().toISOString(), parent_id: parentId ?? null };
}

export async function deleteNote(noteId: string, updateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // RLS enforces: sender can delete own note, artist can delete notes on their content
  await supabase.from("project_notes").delete().eq("id", noteId);

  revalidatePath(`/projects/${updateId}`);
}

export async function deleteMyNote(noteId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase
    .from("project_notes")
    .delete()
    .eq("id", noteId)
    .eq("sender_id", user.id);

  revalidatePath("/profile/notes");
}

/** The artist hides or shows a note on their own update (RLS: artist only). */
export async function setNoteHidden(noteId: string, updateId: string, hidden: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("project_notes")
    .update({ is_visible: !hidden })
    .eq("id", noteId)
    .eq("artist_id", user.id);
  if (error) return { error: "We couldn't change that note. Try again." };
  revalidatePath(`/projects/${updateId}`);
  return {};
}

/** The artist turns notes on or off for one of their updates. */
export async function setNotesOff(updateId: string, off: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await supabase
    .from("project_updates")
    .update({ notes_off: off })
    .eq("id", updateId)
    .eq("artist_id", user.id)
    .select("project_id")
    .maybeSingle();
  if (error || !data) return { error: "We couldn't change that. Try again." };
  revalidateUpdate(updateId, data.project_id ?? null);
  revalidatePath("/feed");
  return {};
}

/** Whether the signed-in viewer muted the notes on this update. */
export async function getNoteThreadMuted(updateId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("update_note_mutes")
    .select("update_id")
    .eq("user_id", user.id)
    .eq("update_id", updateId)
    .maybeSingle();
  return !!data;
}

/** Mute or unmute notifications for the notes on one update. */
export async function setNoteThreadMuted(updateId: string, muted: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = muted
    ? await supabase.from("update_note_mutes").upsert({ user_id: user.id, update_id: updateId })
    : await supabase.from("update_note_mutes").delete().eq("user_id", user.id).eq("update_id", updateId);
  if (error) return { error: "We couldn't change that. Try again." };
  return {};
}
