import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/messages";

export const metadata = { title: "Messages — Patronage" };

function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return "just now";
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  return `${Math.floor(d / 1440)}d ago`;
}

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const conversations = await getConversations();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Messages</h1>
        <p className="text-xs text-muted-foreground">{conversations.length} conversation{conversations.length !== 1 ? "s" : ""}</p>
      </div>

      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground border-t border-border pt-8">
          No messages yet. Visit an artist profile to start a conversation.
        </p>
      ) : (
        <div className="border-t border-black">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className="flex items-center gap-4 border-b border-black py-3 px-2 hover:bg-muted/30 transition-colors group"
            >
              {/* Avatar */}
              <div className="relative w-10 h-10 shrink-0 overflow-hidden border border-black bg-neutral-100">
                {conv.other_avatar_url ? (
                  <Image
                    src={conv.other_avatar_url}
                    alt={conv.other_username}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-muted-foreground uppercase">
                    {conv.other_username.slice(0, 1)}
                  </span>
                )}
              </div>

              {/* Name + last message */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug truncate group-hover:underline underline-offset-2 ${conv.unread_count > 0 ? "font-semibold" : ""}`}>
                  {conv.other_full_name ?? conv.other_username}
                </p>
                {conv.last_message && (
                  <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                )}
              </div>

              {/* Timestamp + unread dot */}
              <div className="flex items-center gap-2 shrink-0">
                {conv.last_message_at && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {timeAgo(conv.last_message_at)}
                  </span>
                )}
                {conv.unread_count > 0 && (
                  <span className="w-2 h-2 rounded-full bg-black shrink-0" />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
