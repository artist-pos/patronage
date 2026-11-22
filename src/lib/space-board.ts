import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

/**
 * The Here Together pinboard at /partners/here-together/space (migration 228).
 * Notes are public; appreciation rows are service-role only, so "which did I
 * appreciate" is answered here, server side.
 *
 * Local testing: in `npm run dev` only, if the 228 tables don't exist yet, the
 * board falls back to an in-memory store (lost on restart) so it can be
 * exercised without touching the live database. Production never does this.
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const SPACE_NOTE_MAX = 280;
export const SPACE_NAME_MAX = 60;
export const SPACE_DEVICE_COOKIE = "pt_space_device";
const BOARD_LIMIT = 500;

export interface SpaceNote {
  id: string;
  body: string;
  author_name: string;
  appreciation_count: number;
  hidden: boolean;
  created_at: string;
}

const COLUMNS = "id, body, author_name, appreciation_count, hidden, created_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ── Dev-only fallback ───────────────────────────────────────────────────────

interface DevStore {
  notes: SpaceNote[];
  votes: Set<string>; // `${noteId}|${voterKey}`
}

function tableMissing(error: { code?: string; message?: string } | null): boolean {
  if (process.env.NODE_ENV !== "development" || !error) return false;
  return error.code === "PGRST205" || error.code === "42P01" || /schema cache|does not exist/i.test(error.message ?? "");
}

// Sample notes so the dev board has something on it. Never in production.
const DEV_SAMPLES: [string, string, number][] = [
  ["Big sinks, a loading door and somewhere to make a mess without apologising.", "Test Artist", 4],
  ["Crits on Thursday nights.", "Test Artist", 2],
  ["Cheap shared studios, 24-hour access, a decent kettle, and walls you can actually drill into. A wee shop for prints would help everyone pay rent.", "Test Artist", 7],
  ["A darkroom!!", "Mere", 1],
  ["Somewhere I can bring my kid on a Saturday and still get work done. A corner with paper and crayons would change my life.", "Sam L.", 3],
  ["Shows that change every few weeks so there's a reason to keep coming back.", "Aroha", 0],
  ["Proper ventilation for resin and spray. Nobody ever plans for it.", "Jordan", 5],
  ["A long table where you can sit with strangers and draw.", "Lena", 0],
  ["Somewhere quiet. Not everything has to be an event.", "Tama", 2],
];

function devSamples(): SpaceNote[] {
  const now = Date.now();
  return DEV_SAMPLES.map(([body, author_name, appreciation_count], i) => ({
    id: crypto.randomUUID(),
    body,
    author_name,
    appreciation_count,
    hidden: false,
    created_at: new Date(now - i * 3_600_000).toISOString(),
  }));
}

function devStore(): DevStore {
  const g = globalThis as unknown as { __spaceBoardDev?: DevStore };
  if (!g.__spaceBoardDev) {
    console.warn("[space board] 228 tables not found: using the in-memory dev store.");
    g.__spaceBoardDev = { notes: devSamples(), votes: new Set() };
  }
  return g.__spaceBoardDev;
}

// ── Device + voter identity ─────────────────────────────────────────────────

/** The viewer's device id from its cookie, or null. Does not set one. */
export async function readDeviceId(): Promise<string | null> {
  const v = (await cookies()).get(SPACE_DEVICE_COOKIE)?.value ?? null;
  return v && UUID.test(v) ? v : null;
}

/** The device id, creating the cookie if needed. Server actions only. */
export async function ensureDeviceId(): Promise<string> {
  const existing = await readDeviceId();
  if (existing) return existing;
  const id = crypto.randomUUID();
  (await cookies()).set(SPACE_DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

export function voterKey(userId: string | null, deviceId: string | null): string | null {
  if (userId) return `u:${userId}`;
  if (deviceId) return `d:${deviceId}`;
  return null;
}

export function isUuid(v: string): boolean {
  return UUID.test(v);
}

// ── Reads ───────────────────────────────────────────────────────────────────

/** Newest first. Never sorted by count. Admins (via RLS) also get hidden notes. */
export async function getSpaceNotes(supabase: ServerClient, admin: boolean): Promise<SpaceNote[]> {
  const { data, error } = await supabase
    .from("space_notes")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(BOARD_LIMIT);
  if (tableMissing(error)) return devStore().notes.filter((n) => admin || !n.hidden);
  if (error) {
    console.error("space notes read failed:", error.message);
    return [];
  }
  return (data ?? []) as SpaceNote[];
}

/** Which notes this voter has appreciated. */
export async function getAppreciatedNoteIds(key: string | null, noteIds: string[]): Promise<string[]> {
  if (!key || noteIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("space_note_appreciations")
    .select("note_id")
    .eq("voter_key", key)
    .in("note_id", noteIds.slice(0, BOARD_LIMIT));
  if (tableMissing(error)) return noteIds.filter((id) => devStore().votes.has(`${id}|${key}`));
  return (data ?? []).map((r: { note_id: string }) => r.note_id);
}

// ── Writes (callers have already run the spam guards / admin check) ─────────

export async function insertSpaceNote(input: { body: string; name: string; userId: string | null }): Promise<SpaceNote | null> {
  const { data, error } = await createAdminClient()
    .from("space_notes")
    .insert({ body: input.body, author_name: input.name, user_id: input.userId })
    .select(COLUMNS)
    .single();
  if (tableMissing(error)) {
    const note: SpaceNote = {
      id: crypto.randomUUID(),
      body: input.body,
      author_name: input.name,
      appreciation_count: 0,
      hidden: false,
      created_at: new Date().toISOString(),
    };
    devStore().notes.unshift(note);
    return note;
  }
  if (error || !data) {
    console.error("space note insert failed:", error?.message);
    return null;
  }
  return data as SpaceNote;
}

/** Adds or removes one voter's appreciation. Returns the new count, or null on failure. */
export async function writeAppreciation(noteId: string, key: string, on: boolean): Promise<number | null> {
  const admin = createAdminClient();
  const { error } = on
    ? await admin
        .from("space_note_appreciations")
        .upsert({ note_id: noteId, voter_key: key }, { onConflict: "note_id,voter_key", ignoreDuplicates: true })
    : await admin.from("space_note_appreciations").delete().eq("note_id", noteId).eq("voter_key", key);

  if (tableMissing(error)) {
    const store = devStore();
    const note = store.notes.find((n) => n.id === noteId);
    if (!note) return null;
    const k = `${noteId}|${key}`;
    if (on && !store.votes.has(k)) {
      store.votes.add(k);
      note.appreciation_count += 1;
    } else if (!on && store.votes.delete(k)) {
      note.appreciation_count = Math.max(0, note.appreciation_count - 1);
    }
    return note.appreciation_count;
  }
  if (error) return null;

  const { data } = await admin.from("space_notes").select("appreciation_count").eq("id", noteId).maybeSingle();
  return data?.appreciation_count ?? null;
}

/** Admin hide/unhide, through RLS with the admin's own session. */
export async function writeNoteHidden(supabase: ServerClient, noteId: string, hidden: boolean): Promise<string | null> {
  const { error } = await supabase
    .from("space_notes")
    .update({ hidden, hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", noteId);
  if (tableMissing(error)) {
    const note = devStore().notes.find((n) => n.id === noteId);
    if (note) note.hidden = hidden;
    return null;
  }
  return error ? error.message : null;
}
