import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { sendFollowup, sendReminder } from "@/lib/rabobank/artist-email";
import { formatNzDate } from "@/lib/rabobank/time";

const BUCKET = "rabobank-pilot";
export const RETENTION_DAYS = 30;
export const REMINDER_DAY = 21;
const DAY = 864e5;

/** Storage path inside the pilot bucket for a public URL we issued, else null. */
function pathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

/**
 * Deletes an artist profile: its card, works, photo and image files (full and
 * thumbnail). Reactions to it go with the card. The quote is a project record
 * and stays. A row in rabobank_deletion_log records only that it happened.
 */
export async function deleteArtistProfile(artistId: string, reason: "no_reply" | "artist_request" | "admin") {
  const admin = createAdminClient();
  const [{ data: artist }, { data: works }] = await Promise.all([
    admin.from("rabobank_artist").select("id, invite_id, photo_url, state").eq("id", artistId).maybeSingle(),
    admin.from("rabobank_work").select("image_url, thumb_url").eq("artist_id", artistId),
  ]);
  if (!artist) return { ok: false as const, error: "Not found." };
  if (artist.state === "kept" && reason === "no_reply") return { ok: false as const, error: "Kept profiles are never deleted automatically." };

  const paths = [artist.photo_url, ...(works ?? []).flatMap((w) => [w.image_url, w.thumb_url])]
    .map(pathOf)
    .filter((p): p is string => !!p);
  // Photos are stored with a -thumb sibling too.
  const withThumbs = [...new Set(paths.flatMap((p) => (p.endsWith("-thumb.webp") ? [p] : [p, p.replace(/\.webp$/, "-thumb.webp")])))];
  if (withThumbs.length) await admin.storage.from(BUCKET).remove(withThumbs);

  const { error } = await admin.from("rabobank_artist").delete().eq("id", artistId);
  if (error) return { ok: false as const, error: error.message };
  await admin.from("rabobank_deletion_log").insert({ artist_id: artistId, invite_id: artist.invite_id, reason });
  return { ok: true as const };
}

type Pending = { id: string; invite_id: string | null; state: string | null; visibility_choice: string | null; followup_sent_at: string | null; reminder_sent_at: string | null };

/** Profiles that are not kept: private_only, or never answered the choice. */
async function pendingProfiles(): Promise<Pending[]> {
  const { data } = await createAdminClient()
    .from("rabobank_artist")
    .select("id, invite_id, state, visibility_choice, followup_sent_at, reminder_sent_at")
    .not("invite_id", "is", null)
    .or("state.is.null,state.neq.kept");
  return ((data ?? []) as Pending[]).filter((a) => a.state !== "kept" && a.state !== "deleted");
}

async function contactFor(inviteId: string | null) {
  if (!inviteId) return null;
  const { data } = await createAdminClient()
    .from("rabobank_artist_invite")
    .select("token, first_name, email")
    .eq("id", inviteId)
    .maybeSingle();
  return data?.email ? data : null;
}

/**
 * The whole retention schedule, anchored to selection close (never to submission):
 * day 0 the keep-or-delete email, day 21 one reminder, day 30 deletion.
 * Safe to run repeatedly; each step happens once.
 */
export async function runRetention(now = new Date()) {
  const settings = await getSettings();
  const report = { followups: 0, reminders: 0, deleted: 0, skippedNoEmail: 0, errors: [] as string[] };
  if (!settings.selection_closed_at) return report;
  const closed = new Date(settings.selection_closed_at).getTime();
  const deleteDate = formatNzDate(new Date(closed + RETENTION_DAYS * DAY).toISOString());
  if (now.getTime() < closed) return report;
  const days = (now.getTime() - closed) / DAY;
  const admin = createAdminClient();

  for (const a of await pendingProfiles()) {
    try {
      if (days >= RETENTION_DAYS) {
        const r = await deleteArtistProfile(a.id, "no_reply");
        if (r.ok) report.deleted++;
        else report.errors.push(`${a.id}: ${r.error}`);
        continue;
      }
      const contact = await contactFor(a.invite_id);
      if (!a.followup_sent_at) {
        if (!contact) { report.skippedNoEmail++; continue; }
        await sendFollowup({ to: contact.email!, firstName: contact.first_name, token: contact.token, deleteDate });
        await admin.from("rabobank_artist").update({ followup_sent_at: now.toISOString() }).eq("id", a.id);
        report.followups++;
      } else if (days >= REMINDER_DAY && !a.reminder_sent_at) {
        if (!contact) { report.skippedNoEmail++; continue; }
        await sendReminder({ to: contact.email!, firstName: contact.first_name, token: contact.token, deleteDate });
        await admin.from("rabobank_artist").update({ reminder_sent_at: now.toISOString() }).eq("id", a.id);
        report.reminders++;
      }
    } catch (err) {
      report.errors.push(`${a.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return report;
}
