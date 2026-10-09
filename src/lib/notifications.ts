import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "sale"
  | "support"
  | "transfer_request"
  | "transfer_accepted"
  | "note"
  | "roster_invite"
  | "roster_accepted"
  | "roster_declined"
  | "roster_left"
  | "roster_removed";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

/** Called fire-and-forget from commerce handlers (uses admin client). */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string | null,
  link: string | null,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link });
}

/** Initial badge count for the Header server component. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count ?? 0;
}

/** What a roster entry is called, by the relationship the organisation keeps. */
export function rosterNoun(relationship: string | null | undefined): string {
  switch (relationship) {
    case "represented":
      return "a represented artist";
    case "participant":
      return "a past participant";
    case "member":
      return "a member";
    default:
      return "an artist";
  }
}

/**
 * Tells the organisation what an artist did with its roster entry. Only for
 * organisation rosters: an artist-run collective has no org to tell.
 * Fire-and-forget; never blocks the artist's action.
 */
export async function notifyRosterOrg(
  collectiveId: string,
  artistId: string,
  kind: "roster_accepted" | "roster_declined" | "roster_left",
): Promise<void> {
  const admin = createAdminClient();
  const [{ data: collective }, { data: artist }] = await Promise.all([
    admin.from("collectives").select("org_profile_id").eq("id", collectiveId).single(),
    admin.from("profiles").select("full_name, username").eq("id", artistId).single(),
  ]);
  const orgId = (collective as { org_profile_id: string | null } | null)?.org_profile_id;
  if (!orgId) return;

  const a = artist as { full_name: string | null; username: string } | null;
  const name = a?.full_name ?? a?.username ?? "An artist";
  const title =
    kind === "roster_accepted"
      ? `${name} accepted your invitation`
      : kind === "roster_declined"
        ? `${name} declined your invitation`
        : `${name} has left your list`;
  const body =
    kind === "roster_accepted"
      ? "They now appear on your public page."
      : kind === "roster_declined"
        ? "They will not appear on your page."
        : "They no longer appear on your public page.";

  await createNotification(orgId, kind, title, body, "/partner/roster");
}

/** Tells an artist an organisation has invited them to, or removed them from, its list. */
export async function notifyRosterArtist(
  artistId: string,
  orgName: string,
  relationship: string | null | undefined,
  kind: "roster_invite" | "roster_removed",
): Promise<void> {
  if (kind === "roster_invite") {
    await createNotification(
      artistId,
      kind,
      `${orgName} invited you to be listed`,
      `They would like to list you as ${rosterNoun(relationship)}. Nothing appears until you accept.`,
      "/studio/profile#groups",
    );
  } else {
    await createNotification(
      artistId,
      kind,
      `${orgName} removed you from their list`,
      "You no longer appear on their public page.",
      "/studio/profile#groups",
    );
  }
}
