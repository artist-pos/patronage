import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType = "sale" | "support" | "transfer_request" | "transfer_accepted" | "note";

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
