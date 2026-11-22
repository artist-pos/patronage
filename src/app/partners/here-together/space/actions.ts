"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isSubmittedTooFast } from "@/lib/form-timing";
import { isTorExit, recordBlocked } from "@/lib/bot-guard";
import { isAdmin } from "@/lib/admin";
import { HONEYPOT_FIELD } from "@/components/HoneypotField";
import {
  SPACE_NAME_MAX,
  SPACE_NOTE_MAX,
  ensureDeviceId,
  insertSpaceNote,
  isUuid,
  voterKey,
  writeAppreciation,
  writeNoteHidden,
  type SpaceNote,
} from "@/lib/space-board";

// Links are the usual payload of board spam, and nobody needs one to say what
// they want from a studio.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|xyz|ru|top|link|shop)\b)/i;

/**
 * Post a note to the Here Together board. No account needed, so this is the
 * only way in: the tables have no public insert policy (228) and the note is
 * written with the service role after honeypot, timing, Tor, link and rate
 * limit checks. No Turnstile, by choice: a CAPTCHA costs too many people
 * arriving from an Instagram story, and admins can hide anything that slips through.
 */
export async function postSpaceNote(data: {
  body: string;
  name: string;
  loadedAt?: number;
  [HONEYPOT_FIELD]?: string;
}): Promise<{ error?: string; note?: SpaceNote }> {
  // Bots get a quiet "success" so they don't retry with a cleaner payload.
  if (data[HONEYPOT_FIELD] || isSubmittedTooFast(data.loadedAt)) return {};

  const body = (data.body ?? "").replace(/[ \t]+\n/g, "\n").trim();
  const name = (data.name ?? "").replace(/\s+/g, " ").trim();
  if (!body) return { error: "Write something on your note first." };
  if (!name) return { error: "Add your name so people know who it's from." };
  if (body.length > SPACE_NOTE_MAX) return { error: `Keep it to ${SPACE_NOTE_MAX} characters.` };
  if (name.length > SPACE_NAME_MAX) return { error: `Keep your name to ${SPACE_NAME_MAX} characters.` };
  if (LINK.test(body) || LINK.test(name)) return { error: "Links can't go on the board. Just say it in words." };

  const ip = await getClientIp();
  if (await isTorExit(ip)) {
    await recordBlocked("form_blocked", { reason: "tor", form: "space_note" });
    return {};
  }
  const device = await ensureDeviceId();
  // Mobile networks share addresses (CGNAT), so the per-IP limit is loose and
  // the per-device one does the real work.
  if (
    !(await checkRateLimit(`space-note:ip:${ip}`, 30, 3600)) ||
    !(await checkRateLimit(`space-note:device:${device}`, 5, 3600))
  ) {
    return { error: "That's a lot of notes. Give it a little while and try again." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const note = await insertSpaceNote({ body, name, userId: user?.id ?? null });
  if (!note) return { error: "Couldn't post that. Please try again." };
  return { note };
}

/**
 * Appreciate (or take back) a note. One per account, or per device when signed
 * out. Returns the note's new count.
 */
export async function setSpaceAppreciation(
  noteId: string,
  appreciated: boolean,
): Promise<{ error?: string; count?: number }> {
  if (!isUuid(noteId)) return { error: "Unknown note." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const key = voterKey(user?.id ?? null, user ? null : await ensureDeviceId());
  if (!key) return { error: "Couldn't save that." };

  const ip = await getClientIp();
  if (!(await checkRateLimit(`space-appreciate:ip:${ip}`, 300, 3600))) {
    return { error: "Slow down a little and try again." };
  }

  const count = await writeAppreciation(noteId, key, appreciated);
  if (count === null) return { error: "Couldn't save that." };
  return { count };
}

/** Admins hide (or bring back) a note. Goes through RLS, not the service role. */
export async function setSpaceNoteHidden(noteId: string, hidden: boolean): Promise<{ error?: string }> {
  if (!isUuid(noteId)) return { error: "Unknown note." };
  if (!(await isAdmin())) return { error: "Not authorised." };
  const error = await writeNoteHidden(await createClient(), noteId, hidden);
  return error ? { error } : {};
}
