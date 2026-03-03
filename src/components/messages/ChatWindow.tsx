"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markConversationRead } from "@/app/messages/actions";
import { acceptTransfer } from "@/app/messages/transfer-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Message, PortfolioImage } from "@/types/database";

interface Props {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  otherName: string;
  workMap?: Record<string, PortfolioImage>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatWindow({ conversationId, currentUserId, initialMessages, otherName, workMap = {} }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.sender_id !== currentUserId) {
            markConversationRead(conversationId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId, supabase]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    setContent("");

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: trimmed,
      is_read: false,
      message_type: "text",
      work_id: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const result = await sendMessage(conversationId, trimmed);
    if (result.error) {
      setError(result.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
    setSending(false);
  }

  async function handleAcceptTransfer(messageId: string) {
    setAcceptingId(messageId);
    const result = await acceptTransfer(messageId);
    setAcceptingId(null);
    if (result.error) {
      showToast(`Error: ${result.error}`);
    } else {
      showToast("Transfer accepted — work added to your collection");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Build a set of work IDs that have been accepted (transfer_accepted messages)
  const acceptedWorkIds = new Set(
    messages
      .filter((m) => m.message_type === "transfer_accepted" && m.work_id)
      .map((m) => m.work_id as string)
  );

  function renderMessage(msg: Message) {
    const isMe = msg.sender_id === currentUserId;

    if (msg.message_type === "transfer_request") {
      const work = msg.work_id ? workMap[msg.work_id] : null;
      const isAccepted = msg.work_id ? acceptedWorkIds.has(msg.work_id) : false;

      return (
        <div key={msg.id} className="flex justify-center">
          <div className="border border-black bg-background w-full max-w-sm">
            {/* Work thumbnail + info */}
            <div className="flex">
              {work && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={work.url}
                  alt={work.caption ?? "Work"}
                  className="w-20 h-20 object-cover flex-none border-r border-black"
                />
              )}
              <div className="p-3 flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Transfer Offer
                </p>
                <p className="text-sm font-medium truncate">{work?.caption ?? "Untitled"}</p>
                {work?.price && !work.hide_price && (
                  <p className="text-xs text-muted-foreground">{work.price}</p>
                )}
              </div>
            </div>

            {/* Action area */}
            <div className="border-t border-black px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-mono">{formatTime(msg.created_at)}</span>
              {isAccepted ? (
                <span className="text-xs font-semibold">Transferred ✓</span>
              ) : isMe ? (
                <span className="text-xs text-muted-foreground italic">Pending acceptance…</span>
              ) : (
                <Button
                  size="sm"
                  className="text-xs h-7"
                  disabled={acceptingId === msg.id}
                  onClick={() => handleAcceptTransfer(msg.id)}
                >
                  {acceptingId === msg.id ? "Accepting…" : "Accept Transfer"}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (msg.message_type === "transfer_accepted") {
      const work = msg.work_id ? workMap[msg.work_id] : null;
      const who = isMe ? "You" : otherName;
      return (
        <div key={msg.id} className="flex justify-center">
          <p className="text-xs text-muted-foreground font-mono py-1">
            {who} accepted the transfer{work?.caption ? ` of "${work.caption}"` : ""}
          </p>
        </div>
      );
    }

    // Default: text message
    return (
      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[72%] px-3 py-2 text-sm ${
            isMe
              ? "bg-black text-white"
              : "border border-black bg-background"
          }`}
        >
          <p className="break-words">{msg.content}</p>
          <p className={`text-[10px] font-mono mt-1 ${isMe ? "text-white/50" : "text-muted-foreground"}`}>
            {formatTime(msg.created_at)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-4 py-2 z-50">
          {toast}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Start a conversation with {otherName}.
          </p>
        )}
        {messages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive pb-2">{error}</p>
      )}

      {/* Input row */}
      <div className="border-t border-black pt-4 flex gap-2">
        <Input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1 border border-black focus:ring-black"
          disabled={sending}
          autoFocus
        />
        <Button
          onClick={handleSend}
          disabled={!content.trim() || sending}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
