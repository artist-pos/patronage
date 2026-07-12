"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ShoppingBag, Heart, ArrowLeftRight, MessageSquare } from "lucide-react";
import { createRealtimeClient } from "@/lib/supabase/client";
import { markNotificationsRead } from "@/app/notifications/actions";
import type { Notification } from "@/types/database";

interface Props {
  userId: string;
  initialUnreadCount: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const TYPE_ICON: Record<Notification["type"], React.ReactNode> = {
  sale: <ShoppingBag className="w-3.5 h-3.5 shrink-0" />,
  support: <Heart className="w-3.5 h-3.5 shrink-0" />,
  transfer_request: <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />,
  transfer_accepted: <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />,
  note: <MessageSquare className="w-3.5 h-3.5 shrink-0" />,
};

export function NotificationBell({ userId, initialUnreadCount }: Props) {
  const [unread, setUnread] = useState(initialUnreadCount);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = useRef(createRealtimeClient()).current;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Realtime subscription — increment badge on new notification
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setUnread((c) => c + 1);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    setNotifications((data as Notification[]) ?? []);
    setLoading(false);

    if (unread > 0) {
      setUnread(0);
      markNotificationsRead().catch(console.error);
      // Optimistically mark local rows as read
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  function handleNotificationClick(n: Notification) {
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-black text-white text-[10px] font-semibold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        /* Popover — the one place elevation is functional (border + shadow-lg) */
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden border border-border bg-card shadow-lg z-50">
          <div className="border-b border-border px-4 py-3">
            <p className="t-section-label">Notifications</p>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-stone-100 max-h-[400px] overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                  >
                    <span className="mt-0.5 text-stone-500">{TYPE_ICON[n.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug truncate">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[10px] text-stone-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-black shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
