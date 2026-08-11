"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createRealtimeClient } from "@/lib/supabase/client";
import { deleteChatMessage } from "@/app/chat/actions";
import Link from "next/link";

interface Channel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  body: string | null;
  attachment_type: string | null;
  attachment_id: string | null;
  attachment_meta: Record<string, unknown> | null;
  created_at: string;
  sender?: {
    username: string | null;
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
  };
}

interface StudioUpdate {
  id: string;
  project_id: string | null;
  caption: string | null;
  project_title: string | null;
}

interface SelfProfile {
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
}

const AVATAR_COLORS = [
  "#5a9e6f", "#6b7cb4", "#c47a5a", "#8e6bbf", "#b45a6b",
  "#4a8fa0", "#9e9a5a", "#6b9e8e",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function resolveDisplayName(p: { full_name: string | null; username: string | null } | undefined): string {
  if (!p) return "Unknown";
  const full = (p.full_name ?? "").trim();
  const uname = (p.username ?? "").trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(full);
  if (full && !isEmail) return full;
  if (uname) return uname;
  return "Unknown";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

function unreadKey(channelId: string): string {
  return `chat_last_read:${channelId}`;
}

interface Props {
  userId: string | null;
  username: string | null;
}

export function ChatDropdown({ userId, username }: Props) {
  const [open, setOpen] = useState(false);
  const [maximised, setMaximised] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<StudioUpdate[]>([]);
  const [attachment, setAttachment] = useState<StudioUpdate | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selfProfile, setSelfProfile] = useState<SelfProfile | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, number>>({});
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [menuMsgId, setMenuMsgId] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presenceChannelRef = useRef<any>(null);
  // Stable realtime-enabled client — never recreated on render
  const supabase = useRef(createRealtimeClient()).current;

  // Detect mobile viewport
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Lock body scroll on mobile while panel is open
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, isMobile]);

  // Fetch own profile for avatar + display name in own messages. Deferred until
  // the panel is opened — the closed trigger button doesn't render any of it.
  useEffect(() => {
    if (!open || !userId) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setSelfProfile(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  // Load channels — called when the panel opens, and again if it opens empty
  const loadChannels = useCallback(() => {
    supabase
      .from("chat_channels")
      .select("id, slug, name, description")
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) { console.error("chat_channels fetch failed:", error); return; }
        const ch = (data ?? []) as Channel[];
        setChannels(ch);
        if (ch.length > 0) setActiveChannelId((prev) => prev ?? ch[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loaded on first open, not on mount. Loading channels sets activeChannelId,
  // which cascades into the 60-message fetch, the sender-profile lookup and a
  // realtime subscription below — all of it for a panel nobody has opened yet.
  // NavBar renders this twice (desktop + mobile), so on mount that was six
  // Supabase round-trips on every page in the app.
  useEffect(() => {
    if (open && channels.length === 0) loadChannels();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll to bottom when messages change or panel opens
  useEffect(() => {
    if (!open || !messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, open]);

  // Load messages + subscribe on channel switch
  useEffect(() => {
    if (!activeChannelId) return;

    supabase
      .from("chat_messages")
      .select("id, channel_id, sender_id, body, attachment_type, attachment_id, attachment_meta, created_at")
      .eq("channel_id", activeChannelId)
      .order("created_at", { ascending: true })
      .limit(60)
      .then(async ({ data }) => {
        const msgs = (data ?? []) as ChatMessage[];
        const senderIds = [...new Set(msgs.map(m => m.sender_id).filter(Boolean) as string[])];
        const senderMap: Record<string, ChatMessage["sender"]> = {};
        if (senderIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, full_name, role, avatar_url")
            .in("id", senderIds);
          for (const p of profiles ?? []) {
            senderMap[p.id] = { username: p.username, full_name: p.full_name, role: p.role, avatar_url: p.avatar_url };
          }
        }
        setMessages(msgs.map(m => ({ ...m, sender: m.sender_id ? senderMap[m.sender_id] : undefined })));
      });

    localStorage.setItem(unreadKey(activeChannelId), new Date().toISOString());
    setUnreadMap(prev => ({ ...prev, [activeChannelId]: 0 }));

    subscriptionRef.current?.unsubscribe?.();
    const sub = supabase
      .channel(`chat:${activeChannelId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `channel_id=eq.${activeChannelId}`,
      }, async (payload) => {
        const msg = payload.new as ChatMessage;
        // Skip own messages — already in state via optimistic update
        if (msg.sender_id === userId) return;
        if (msg.sender_id) {
          const { data: p } = await supabase
            .from("profiles")
            .select("username, full_name, role, avatar_url")
            .eq("id", msg.sender_id)
            .maybeSingle();
          if (p) msg.sender = { username: p.username, full_name: p.full_name, role: p.role, avatar_url: p.avatar_url };
        }
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        localStorage.setItem(unreadKey(activeChannelId), new Date().toISOString());
      })
      .subscribe();
    subscriptionRef.current = sub;

    return () => { subscriptionRef.current?.unsubscribe?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  // Unread counts for other channels
  useEffect(() => {
    if (!open || channels.length === 0) return;
    async function computeUnread() {
      const map: Record<string, number> = {};
      await Promise.all(channels.map(async (ch) => {
        if (ch.id === activeChannelId) { map[ch.id] = 0; return; }
        const lastRead = localStorage.getItem(unreadKey(ch.id));
        if (!lastRead) { map[ch.id] = 0; return; }
        const { count } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", ch.id)
          .gt("created_at", lastRead);
        map[ch.id] = count ?? 0;
      }));
      setUnreadMap(map);
    }
    computeUnread();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channels]);

  // Presence: track which channel the user is viewing; build per-channel online counts
  useEffect(() => {
    if (!open || !userId || !activeChannelId) {
      presenceChannelRef.current?.untrack?.();
      presenceChannelRef.current = null;
      return;
    }

    const ch = supabase.channel("community:presence", {
      config: { presence: { key: userId } },
    });

    function syncPresence() {
      const state = ch.presenceState<{ channel_id: string }>();
      const map: Record<string, number> = {};
      for (const [key, presences] of Object.entries(state)) {
        if (key === userId) continue; // exclude self
        for (const p of presences as Array<{ channel_id: string }>) {
          if (p.channel_id) map[p.channel_id] = (map[p.channel_id] ?? 0) + 1;
        }
      }
      setPresenceMap(map);
    }

    ch.on("presence", { event: "sync" }, syncPresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await ch.track({ channel_id: activeChannelId });
        }
      });

    presenceChannelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      presenceChannelRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  // Update presence when switching channels (without re-subscribing)
  useEffect(() => {
    if (!presenceChannelRef.current || !activeChannelId) return;
    presenceChannelRef.current.track({ channel_id: activeChannelId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  // Picker: click-outside to close
  useEffect(() => {
    if (!showPicker) return;
    function onMouseDown(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showPicker]);

  // Picker: Escape to close
  useEffect(() => {
    if (!showPicker) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowPicker(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPicker]);

  const totalUnread = Object.values(unreadMap).reduce((s, n) => s + n, 0);

  const loadStudioUpdates = useCallback(async () => {
    if (!userId) return;
    // Use `caption` (not `title` — that column is added in migration 127)
    // projects(title) join is safe since project_id FK pre-dates migration 127
    const { data } = await supabase
      .from("project_updates")
      .select("id, caption, project_id, projects(title)")
      .eq("artist_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    setRecentUpdates(
      (data ?? []).map((u) => {
        const project = (u.projects as { title?: string } | null);
        return {
          id: u.id,
          project_id: (u as { project_id?: string | null }).project_id ?? null,
          caption: (u as { caption?: string | null }).caption ?? null,
          project_title: project?.title ?? null,
        };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function doSend() {
    if (!userId || !activeChannelId || (!input.trim() && !attachment)) return;
    setSending(true);

    const body = input.trim() || null;
    const meta = attachment ? {
      caption: attachment.caption,
      project_title: attachment.project_title,
      project_id: attachment.project_id,
    } : null;

    // Optimistic update — show immediately without waiting for realtime
    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      channel_id: activeChannelId!,
      sender_id: userId,
      body,
      attachment_type: attachment ? "studio_update" : null,
      attachment_id: attachment?.id ?? null,
      attachment_meta: meta,
      created_at: new Date().toISOString(),
      sender: {
        username,
        full_name: selfProfile?.full_name ?? null,
        role: null,
        avatar_url: selfProfile?.avatar_url ?? null,
      },
    };
    setMessages(prev => [...prev, optimistic]);
    setInput("");
    setAttachment(null);

    const payload: Record<string, unknown> = {
      channel_id: activeChannelId,
      sender_id: userId,
      body,
    };
    if (attachment) {
      payload.attachment_type = "studio_update";
      payload.attachment_id = attachment.id;
      payload.attachment_meta = meta;
    }
    await supabase.from("chat_messages").insert(payload);
    setSending(false);
  }

  const activeChannel = channels.find(c => c.id === activeChannelId) ?? null;
  const panelHeight = isMobile
    ? "calc(100dvh - 49px)"
    : maximised ? "calc(100dvh - 49px)" : "380px";

  function renderAvatar(msg: ChatMessage, senderName: string) {
    const color = msg.sender_id ? avatarColor(msg.sender_id) : "#bbb";
    const avatarUrl = msg.sender?.avatar_url;
    if (avatarUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={senderName}
          className="w-7 h-7 object-cover shrink-0 mt-0.5"
        />
      );
    }
    return (
      <div
        className="w-7 h-7 flex items-center justify-center text-[10px] font-semibold text-white shrink-0 mt-0.5"
        style={{ background: color }}
      >
        {initials(senderName)}
      </div>
    );
  }

  const triggerBtn = (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
      title="Community chat"
      className="relative text-muted-foreground hover:text-foreground transition-colors"
      aria-label={open ? "Close community chat" : "Open community chat"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {totalUnread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 block" />
      )}
    </button>
  );

  if (!open) return triggerBtn;

  return (
    <>
      {triggerBtn}

      {/* Backdrop */}
      <div
        className="fixed left-0 right-0 bottom-0 z-40"
        style={{ top: 49, backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", background: "rgba(0,0,0,0.08)" }}
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        style={{ height: panelHeight, width: isMobile ? "100vw" : "min(620px, 100vw)", top: 49 }}
        className="fixed right-0 z-50 flex flex-col sm:flex-row border border-stone-200 border-t-0 bg-white shadow-xl sm:rounded-bl-xl overflow-hidden"
      >
        {/* Desktop sidebar — channel list */}
        {!isMobile && (
          <div className="w-[160px] sm:w-[180px] shrink-0 border-r border-stone-100 flex flex-col overflow-y-auto">
            <div className="px-3 py-2.5 border-b border-stone-100">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Community</p>
            </div>
            {channels.map((ch) => {
              const isActive = ch.id === activeChannelId;
              const unread = unreadMap[ch.id] ?? 0;
              const othersOnline = (presenceMap[ch.id] ?? 0) > 0;
              const dotClass = othersOnline
                ? "bg-emerald-500"
                : isActive
                ? "bg-stone-600"
                : "bg-stone-300";
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-stone-50 text-stone-900 border-l-2 border-stone-900"
                      : "text-stone-600 hover:bg-stone-50 border-l-2 border-transparent"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
                  <span className="flex-1 truncate">{ch.name}</span>
                  {unread > 0 && (
                    <span className="text-[10px] font-medium bg-stone-900 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Main message area — min-h-0 lets the messages pane actually
            shrink inside the flex column so its own scrollbar activates
            (without it, mobile clips instead of scrolling) */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Mobile: horizontal channel tabs */}
          {isMobile && (
            <div className="flex items-center gap-1 px-3 py-2 border-b border-stone-100 overflow-x-auto">
              {channels.map((ch) => {
                const isActive = ch.id === activeChannelId;
                const unread = unreadMap[ch.id] ?? 0;
                const othersOnline = (presenceMap[ch.id] ?? 0) > 0;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setActiveChannelId(ch.id)}
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                      isActive ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    }`}
                  >
                    {othersOnline && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    {ch.name}
                    {unread > 0 && (
                      <span className={`text-[9px] font-medium rounded-full px-1 ${isActive ? "bg-white text-stone-900" : "bg-stone-900 text-white"}`}>
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Topbar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{activeChannel?.name ?? "Chat"}</p>
              {activeChannel?.description && !isMobile && (
                <p className="text-xs text-stone-400 truncate">{activeChannel.description}</p>
              )}
            </div>
            {!isMobile && (
              <button
                type="button"
                onClick={() => setMaximised(v => !v)}
                className="text-stone-400 hover:text-stone-700 transition-colors p-1"
                aria-label={maximised ? "Minimise" : "Maximise"}
              >
                {maximised ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-stone-400 hover:text-stone-700 transition-colors p-1"
              aria-label="Close chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-4">No messages yet. Say hello!</p>
            )}
            {messages.map((msg) => {
              const senderName = resolveDisplayName(msg.sender);
              const isOwnMessage = msg.sender_id === userId;
              const isArtist = msg.sender?.role === "artist" || msg.sender?.role === "owner";
              const isAdmin = selfProfile?.role === "admin" || selfProfile?.role === "owner";
              const canDelete = isAdmin || isOwnMessage;
              const meta = msg.attachment_meta as {
                caption?: string;
                project_title?: string;
                project_id?: string | null;
              } | null;

              return (
                <div
                  key={msg.id}
                  className={`group relative flex gap-2.5 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                  onMouseEnter={() => setHoveredMsgId(msg.id)}
                  onMouseLeave={() => { setHoveredMsgId(null); if (menuMsgId === msg.id) setMenuMsgId(null); }}
                >
                  {renderAvatar(msg, senderName)}
                  <div className={`flex-1 min-w-0 ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`flex items-center gap-1.5 mb-0.5 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
                      <span className="text-[11px] font-medium text-stone-700">
                        {isOwnMessage ? "You" : senderName}
                      </span>
                      {isArtist && !isOwnMessage && (
                        <span className="text-[9px] bg-stone-100 text-stone-500 rounded-full px-1.5 py-0.5">Artist</span>
                      )}
                      <span className="text-[10px] text-stone-400">{formatTime(msg.created_at)}</span>
                    </div>
                    {msg.body && (
                      <p className={`text-xs rounded-xl px-3 py-2 max-w-[260px] break-words leading-relaxed ${
                        isOwnMessage ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-800"
                      }`}>
                        {msg.body}
                      </p>
                    )}
                    {msg.attachment_type === "studio_update" && meta && (() => {
                      const inner = (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-stone-400 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <div className="min-w-0">
                            {meta.project_title && (
                              <p className="text-[10px] text-stone-400 truncate">{meta.project_title}</p>
                            )}
                            <p className="text-stone-700 font-medium truncate">{meta.caption ?? "Studio update"}</p>
                          </div>
                          <span className="text-stone-400 shrink-0 ml-auto text-[10px]">→</span>
                        </>
                      );
                      const cls = "border border-stone-200 rounded-lg px-3 py-2 mt-1 bg-white text-xs flex items-center gap-2 max-w-[260px]";
                      return meta.project_id ? (
                        <Link href={`/threads/${meta.project_id}`} onClick={() => setOpen(false)} className={`${cls} hover:border-stone-300 hover:bg-stone-50 transition-colors`}>
                          {inner}
                        </Link>
                      ) : (
                        <div className={cls}>{inner}</div>
                      );
                    })()}
                  </div>

                  {/* 3-dot delete menu — shown on hover for admin or own messages */}
                  {canDelete && (hoveredMsgId === msg.id || menuMsgId === msg.id) && (
                    <div className={`relative self-start mt-0.5 shrink-0 ${isOwnMessage ? "order-first" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setMenuMsgId(prev => prev === msg.id ? null : msg.id)}
                        className="p-1 text-stone-300 hover:text-stone-500 transition-colors rounded"
                        aria-label="Message options"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                      </button>
                      {menuMsgId === msg.id && (
                        <div className={`absolute top-6 z-50 bg-white border border-stone-200 rounded shadow-md py-1 min-w-[110px] ${isOwnMessage ? "right-0" : "left-0"}`}>
                          <button
                            type="button"
                            onClick={async () => {
                              setMenuMsgId(null);
                              setMessages(prev => prev.filter(m => m.id !== msg.id));
                              const result = await deleteChatMessage(msg.id);
                              if (result.error) {
                                // Restore on failure
                                setMessages(prev => [...prev, msg].sort((a, b) => a.created_at.localeCompare(b.created_at)));
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Delete message
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Studio update picker */}
          {showPicker && (
            <div
              ref={pickerRef}
              className="border-t border-stone-100 bg-stone-50 px-4 py-3 max-h-40 overflow-y-auto"
            >
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-2">Attach a studio update</p>
              {recentUpdates.length === 0 ? (
                <p className="text-xs text-stone-400">No recent updates.</p>
              ) : recentUpdates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setAttachment(u); setShowPicker(false); }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-white transition-colors"
                >
                  {u.project_title && <span className="text-stone-400">{u.project_title} · </span>}
                  <span className="text-stone-700">{u.caption ?? "Untitled update"}</span>
                </button>
              ))}
            </div>
          )}

          {/* Attachment preview strip */}
          {attachment && (
            <div className="border-t border-stone-100 px-4 py-2 flex items-center gap-2 text-xs bg-stone-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-stone-400 shrink-0"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              <span className="text-stone-600 truncate">Studio update: {attachment.caption ?? "Untitled"}</span>
              <button type="button" onClick={() => setAttachment(null)} className="ml-auto text-stone-400 hover:text-stone-700 transition-colors flex-shrink-0">×</button>
            </div>
          )}

          {/* Input row */}
          {userId ? (
            <div className="border-t border-stone-100 px-3 py-2.5 flex items-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!showPicker) loadStudioUpdates();
                  setShowPicker(v => !v);
                }}
                className={`transition-colors p-1 shrink-0 ${showPicker ? "text-stone-900" : "text-stone-400 hover:text-stone-700"}`}
                aria-label={showPicker ? "Close attachment picker" : "Attach studio update"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setShowPicker(false); return; }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    doSend();
                  }
                }}
                placeholder="Message…"
                rows={1}
                className="flex-1 resize-none text-xs outline-none bg-transparent text-stone-900 placeholder:text-stone-400 py-1 leading-relaxed"
                style={{ maxHeight: 80 }}
              />
              <button
                type="button"
                onClick={doSend}
                disabled={sending || (!input.trim() && !attachment)}
                className="text-stone-400 hover:text-stone-900 disabled:opacity-30 transition-colors p-1 shrink-0"
                aria-label="Send message"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          ) : (
            <div className="border-t border-stone-100 px-4 py-3 text-center">
              <Link href="/auth/login" className="text-xs text-stone-500 underline underline-offset-2">
                Sign in to chat
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
