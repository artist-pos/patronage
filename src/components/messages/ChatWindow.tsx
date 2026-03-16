"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Info } from "lucide-react";
import { createRealtimeClient } from "@/lib/supabase/client";
import { sendMessage, markConversationRead } from "@/app/messages/actions";
import { acceptTransfer } from "@/app/messages/transfer-actions";
import { approveDeletionRequest } from "@/app/profile/artwork-delete-actions";
import { Button } from "@/components/ui/button";
import type { Message, Artwork } from "@/types/database";

interface Props {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  otherName: string;
  workMap?: Record<string, Artwork>;
  sourceWork?: { url: string; caption: string | null } | null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatWindow({ conversationId, currentUserId, initialMessages, otherName, workMap = {}, sourceWork }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [approvingDeletionId, setApprovingDeletionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Stable ref — prevents the realtime subscription tearing down on every render
  const supabaseRef = useRef(createRealtimeClient());

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Realtime subscription for new messages
  useEffect(() => {
    const supabase = supabaseRef.current;
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
          // Own messages are already in state via optimistic update — skip them
          if (msg.sender_id === currentUserId) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          markConversationRead(conversationId);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-grow textarea as content changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [content]);

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
      offer_amount: null,
      offer_currency: null,
      is_system_message: false,
      source_action: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const result = await sendMessage(conversationId, trimmed);
    if (result.error) {
      setError(result.error);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else if (result.message) {
      // Replace the optimistic entry with the real persisted message
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? result.message! : m));
    }
    setSending(false);
  }

  async function handleAcceptTransfer(messageId: string) {
    setAcceptingId(messageId);
    try {
      const result = await acceptTransfer(messageId);
      if (result.error) {
        showToast(`Error: ${result.error}`);
      } else {
        showToast("Transfer accepted — work added to your collection");
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    } finally {
      setAcceptingId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter falls through to default — inserts a newline
  }

  // Split system notices from regular chat messages
  const systemMessages = messages.filter((m) => m.is_system_message);
  const regularMessages = messages.filter((m) => !m.is_system_message);

  async function handleApproveDeletion(messageId: string) {
    setApprovingDeletionId(messageId);
    try {
      const result = await approveDeletionRequest(messageId);
      if (result.error) {
        showToast(`Error: ${result.error}`);
      } else {
        showToast("Artwork deleted");
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : "Something went wrong"}`);
    } finally {
      setApprovingDeletionId(null);
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
                <Image
                  src={work.url}
                  alt={work.caption ?? "Work"}
                  width={80}
                  height={80}
                  className="object-cover flex-none border-r border-black"
                  style={{ width: 80, height: 80 }}
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

    if (msg.message_type === "deletion_request") {
      const work = msg.work_id ? workMap[msg.work_id] : null;
      const isDeletionApproved = messages.some(
        (m) => m.message_type === "deletion_accepted"
      );

      return (
        <div key={msg.id} className="flex justify-center">
          <div className="border border-black bg-background w-full max-w-sm">
            <div className="flex">
              {work && (
                <Image
                  src={work.url}
                  alt={work.caption ?? "Work"}
                  width={80}
                  height={80}
                  className="object-cover flex-none border-r border-black"
                  style={{ width: 80, height: 80 }}
                />
              )}
              <div className="p-3 flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Deletion Request
                </p>
                <p className="text-sm font-medium truncate">{work?.caption ?? "Untitled"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isMe ? "You requested deletion of this work." : `${otherName} is requesting this work be deleted.`}
                </p>
              </div>
            </div>
            <div className="border-t border-black px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-mono">{formatTime(msg.created_at)}</span>
              {isDeletionApproved ? (
                <span className="text-xs font-semibold">Deleted ✓</span>
              ) : isMe ? (
                <span className="text-xs text-muted-foreground italic">Pending approval…</span>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="text-xs h-7"
                    disabled={approvingDeletionId === msg.id}
                    onClick={() => handleApproveDeletion(msg.id)}
                  >
                    {approvingDeletionId === msg.id ? "Deleting…" : "Approve Deletion"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (msg.message_type === "deletion_accepted") {
      return (
        <div key={msg.id} className="flex justify-center">
          <p className="text-xs text-muted-foreground font-mono py-1">
            Artwork deleted by mutual agreement.
          </p>
        </div>
      );
    }

    if (msg.message_type === "work_offer") {
      const work = msg.work_id ? workMap[msg.work_id] : null;
      const offerDisplay = msg.offer_amount && msg.offer_currency
        ? `${msg.offer_currency} ${msg.offer_amount.toLocaleString("en-NZ")}`
        : null;

      return (
        <div key={msg.id} className="flex justify-center">
          <div className="border border-black bg-background w-full max-w-sm">
            <div className="flex">
              {work && (
                <Image
                  src={work.url}
                  alt={work.caption ?? "Work"}
                  width={80}
                  height={80}
                  className="object-cover flex-none border-r border-black"
                  style={{ width: 80, height: 80 }}
                />
              )}
              <div className="p-3 flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  Offer
                </p>
                <p className="text-sm font-medium truncate">{work?.caption ?? "Untitled"}</p>
                {offerDisplay && (
                  <p className="text-base font-semibold mt-0.5">{offerDisplay}</p>
                )}
              </div>
            </div>
            <div className="border-t border-black px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-mono">{formatTime(msg.created_at)}</span>
              <span className="text-xs text-muted-foreground italic">
                {isMe ? "Offer sent" : "Offer received"}
              </span>
            </div>
          </div>
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

      {/* ── Pinned system notice(s) — always at top, outside the scroll area ── */}
      {systemMessages.length > 0 && (
        <div className="shrink-0 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          {/* Source artwork context */}
          {sourceWork && (
            <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-amber-200/60 dark:border-amber-800/60">
              <Image
                src={sourceWork.url}
                alt={sourceWork.caption ?? "Work"}
                width={40}
                height={40}
                className="object-cover border border-amber-300 dark:border-amber-700 shrink-0"
                style={{ width: 40, height: 40 }}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  Enquiry re:
                </p>
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200 truncate">
                  {sourceWork.caption ?? "Untitled"}
                </p>
              </div>
            </div>
          )}
          {/* Disclaimer */}
          {systemMessages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2.5 px-4 py-3">
              <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-0.5">
                  Notice
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {regularMessages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Start a conversation with {otherName}.
          </p>
        )}
        {regularMessages.map(renderMessage)}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive pb-2">{error}</p>
      )}

      {/* Input row */}
      <div className="border-t border-black pt-4 flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          disabled={sending}
          autoFocus
          className="flex-1 resize-none overflow-hidden border border-black bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-50"
          style={{ minHeight: "2.375rem", maxHeight: "10rem", overflowY: "auto" }}
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
