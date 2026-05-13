"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteChatMessage(messageId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Fetch message + caller's role in parallel
  const [{ data: msg }, { data: profile }] = await Promise.all([
    admin.from("chat_messages").select("sender_id").eq("id", messageId).maybeSingle(),
    admin.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  if (!msg) return { error: "Message not found" };

  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  const isOwn = msg.sender_id === user.id;

  if (!isAdmin && !isOwn) return { error: "Not authorised" };

  const { error } = await admin.from("chat_messages").delete().eq("id", messageId);
  if (error) return { error: error.message };
  return {};
}
