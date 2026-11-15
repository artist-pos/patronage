"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createNotification, mentionedProfileIds, withoutMuted } from "@/lib/notifications";
import { isNoticeKind, NOTICE_MAX } from "@/lib/noticeboard-kinds";

function refresh(noticeId?: string) {
  revalidatePath("/noticeboard");
  revalidatePath("/feed");
  if (noticeId) revalidatePath(`/noticeboard/${noticeId}`);
}

/** The database guard (227) refuses under-18 accounts and closed notices. */
function friendly(message: string, fallback: string): string {
  if (message.includes("under-18")) return "The noticeboard isn't available on under-18 accounts.";
  if (message.includes("closed")) return "This notice has closed, so it can't take new replies.";
  return fallback;
}

/** Post a notice. Runs for 30 days. */
export async function postNotice(input: {
  kind: string;
  body: string;
  regionId: string | null;
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to post a notice." };
  if (!isNoticeKind(input.kind)) return { error: "Choose a kind first." };
  const body = input.body.trim();
  if (!body) return { error: "Write what you need or offer." };
  if (body.length > NOTICE_MAX) return { error: `Keep it to ${NOTICE_MAX} characters.` };

  const { data, error } = await supabase
    .from("notices")
    .insert({ author_id: user.id, kind: input.kind, body, region_id: input.regionId || null })
    .select("id")
    .single();
  if (error || !data) return { error: friendly(error?.message ?? "", "We couldn't post that notice. Try again.") };
  refresh();
  return { id: data.id };
}

/** The poster marks their notice sorted: it leaves the board, thread and all. */
export async function markNoticeSorted(noticeId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase
    .from("notices")
    .update({ sorted_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("author_id", user.id);
  if (error) return { error: "We couldn't mark it sorted. Try again." };
  refresh(noticeId);
  return {};
}

/**
 * Reply to a notice. Notifies, once each and never the writer: the poster,
 * everyone who replied before, and anyone named with @username. Muted threads
 * are skipped.
 */
export async function replyToNotice(noticeId: string, body: string): Promise<{ error?: string; id?: string; created_at?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to reply." };
  const text = body.trim();
  if (!text) return { error: "Write a reply first." };
  if (text.length > 500) return { error: "Keep it to 500 characters." };

  const { data, error } = await supabase
    .from("notice_replies")
    .insert({ notice_id: noticeId, author_id: user.id, body: text })
    .select("id, created_at")
    .single();
  if (error || !data) return { error: friendly(error?.message ?? "", "We couldn't post that reply. Try again.") };

  const [{ data: notice }, { data: earlier }, { data: me }] = await Promise.all([
    supabase.from("notices").select("author_id, body").eq("id", noticeId).single(),
    supabase.from("notice_replies").select("author_id").eq("notice_id", noticeId).eq("hidden", false),
    supabase.from("profiles").select("full_name, username").eq("id", user.id).single(),
  ]);
  const name = me?.full_name ?? me?.username ?? "Someone";
  const link = `/noticeboard/${noticeId}`;
  const snippet = text.slice(0, 100);

  const told = new Set<string>([user.id]);
  const poster = notice && !told.has(notice.author_id) ? notice.author_id : null;
  if (poster) told.add(poster);
  const thread = [...new Set((earlier ?? []).map((r: { author_id: string }) => r.author_id))].filter((id) => !told.has(id));
  thread.forEach((id) => told.add(id));
  const mentioned = (await mentionedProfileIds(text)).filter((id) => !told.has(id));

  const audience = await withoutMuted(
    [poster, ...thread, ...mentioned].filter((id): id is string => !!id),
    "notice_mutes",
    noticeId,
  );
  await Promise.all(
    audience.map((id) =>
      createNotification(
        id,
        "notice_reply",
        id === poster
          ? `${name} replied to your notice`
          : mentioned.includes(id)
            ? `${name} mentioned you on the noticeboard`
            : `${name} replied to a notice you replied to`,
        snippet,
        link,
      ).catch(() => {}),
    ),
  );

  refresh(noticeId);
  return { id: data.id, created_at: data.created_at };
}

/** The poster hides or shows a reply on their notice (RLS: poster only). */
export async function setNoticeReplyHidden(replyId: string, noticeId: string, hidden: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("notice_replies").update({ hidden }).eq("id", replyId);
  if (error) return { error: "We couldn't change that reply. Try again." };
  refresh(noticeId);
  return {};
}

export async function deleteNoticeReply(replyId: string, noticeId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await supabase.from("notice_replies").delete().eq("id", replyId).eq("author_id", user.id);
  if (error) return { error: "We couldn't delete that reply. Try again." };
  refresh(noticeId);
  return {};
}

export async function setNoticeMuted(noticeId: string, muted: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = muted
    ? await supabase.from("notice_mutes").upsert({ user_id: user.id, notice_id: noticeId })
    : await supabase.from("notice_mutes").delete().eq("user_id", user.id).eq("notice_id", noticeId);
  if (error) return { error: "We couldn't change that. Try again." };
  return {};
}
