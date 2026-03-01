import { createClient } from "@/lib/supabase/server";
import type { ConversationWithOther, Message } from "@/types/database";

export async function getConversations(): Promise<ConversationWithOther[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: convs } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b, created_at")
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (!convs || convs.length === 0) return [];

  const results = await Promise.all(
    convs.map(async (conv) => {
      const otherId =
        conv.participant_a === user.id ? conv.participant_b : conv.participant_a;

      const [profileRes, latestRes, unreadRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, full_name, avatar_url")
          .eq("id", otherId)
          .single(),
        supabase
          .from("messages")
          .select("content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("is_read", false)
          .neq("sender_id", user.id),
      ]);

      return {
        id: conv.id,
        other_user_id: otherId,
        other_username: profileRes.data?.username ?? "",
        other_full_name: profileRes.data?.full_name ?? null,
        other_avatar_url: profileRes.data?.avatar_url ?? null,
        last_message: latestRes.data?.content ?? null,
        last_message_at: latestRes.data?.created_at ?? null,
        unread_count: unreadRes.count ?? 0,
      };
    })
  );

  return results;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, is_read, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Message[];
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .neq("sender_id", user.id);

  return count ?? 0;
}
