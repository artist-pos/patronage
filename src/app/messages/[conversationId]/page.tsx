import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/messages";
import { markConversationRead } from "@/app/messages/actions";
import { ChatWindow } from "@/components/messages/ChatWindow";
import { TransferWorkButton } from "@/components/messages/TransferWorkButton";
import type { Artwork } from "@/types/database";

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function ChatPage({ params }: Props) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Verify the user is a participant (RLS will return null if not)
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv) notFound();

  const otherId =
    conv.participant_a === user.id ? conv.participant_b : conv.participant_a;

  const [otherProfile, viewerProfile, messages] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, full_name, avatar_url, role")
      .eq("id", otherId)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then((r) => r.data),
    getMessages(conversationId),
  ]);

  // Mark existing messages as read on load
  await markConversationRead(conversationId);

  const otherName = otherProfile?.full_name ?? otherProfile?.username ?? "Unknown";

  const viewerIsArtist =
    viewerProfile?.role === "artist" || viewerProfile?.role === "owner";

  // If viewer is artist, fetch their available works for transfer
  let artistAvailableWorks: Artwork[] = [];
  if (viewerIsArtist) {
    const { data } = await supabase
      .from("artworks")
      .select("*")
      .eq("creator_id", user.id)
      .eq("is_available", true)
      .order("position", { ascending: true });
    artistAvailableWorks = (data ?? []) as Artwork[];
  }

  // Build workMap for any transfer_request or transfer_accepted messages
  const workIds = messages
    .filter((m) => m.work_id)
    .map((m) => m.work_id as string);

  let workMap: Record<string, Artwork> = {};
  if (workIds.length > 0) {
    const { data: works } = await supabase
      .from("artworks")
      .select("*")
      .in("id", workIds);
    for (const w of works ?? []) {
      workMap[w.id] = w as Artwork;
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8" style={{ height: "calc(100svh - 5rem)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-black pb-4 mb-4 shrink-0">
        <Link
          href="/messages"
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Messages
        </Link>
        <span className="text-muted-foreground text-xs">/</span>
        <p className="text-sm font-semibold">{otherName}</p>
        {otherProfile?.username && (
          <Link
            href={`/${otherProfile.username}`}
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            View profile →
          </Link>
        )}
        {viewerIsArtist && artistAvailableWorks.length > 0 && (
          <TransferWorkButton
            conversationId={conversationId}
            artistAvailableWorks={artistAvailableWorks}
          />
        )}
      </div>

      <ChatWindow
        conversationId={conversationId}
        currentUserId={user.id}
        initialMessages={messages}
        otherName={otherName}
        workMap={workMap}
      />
    </div>
  );
}
