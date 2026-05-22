"use client";

import { useState, useEffect } from "react";
import { X, Send, Ban } from "lucide-react";
import { getQueuedNotifications, flushNotifications, cancelNotification } from "@/app/partner/dashboard/actions";

type QueueItem = Awaited<ReturnType<typeof getQueuedNotifications>>[number];

const TYPE_LABELS: Record<string, string> = {
  shortlisted: "Shortlisted",
  rejected: "Not selected",
  selected: "Selected",
  approved_pending_assets: "Approved — file request",
};

interface Props {
  opportunityId: string;
  onClose: () => void;
}

export function BatchNotificationPanel({ opportunityId, onClose }: Props) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    getQueuedNotifications(opportunityId).then((data) => {
      setItems(data as QueueItem[]);
      setSelected(new Set((data as QueueItem[]).map((i) => i.id as string)));
      setLoading(false);
    });
  }, [opportunityId]);

  function toggleAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id as string)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    setSending(true);
    const result = await flushNotifications([...selected]);
    setSending(false);
    setItems((prev) => prev.filter((i) => !selected.has(i.id as string)));
    setSelected(new Set());
    setToast(`${result.sent} notification${result.sent !== 1 ? "s" : ""} sent.`);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCancel(id: string) {
    await cancelNotification(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-lg h-full bg-background border-l border-black overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-black px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Queued notifications</p>
            <p className="text-xs text-stone-400">{items.length} pending</p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-4">
          {loading && <p className="text-xs text-stone-400">Loading…</p>}

          {!loading && items.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-12">No queued notifications.</p>
          )}

          {!loading && items.length > 0 && (
            <>
              {/* Select all */}
              <label className="flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === items.length}
                  onChange={toggleAll}
                />
                Select all ({items.length})
              </label>

              {/* Items */}
              <div className="space-y-2">
                {items.map((item) => {
                  const profile = (item as unknown as { profiles?: { full_name?: string; username?: string; avatar_url?: string } }).profiles;
                  const name = profile?.full_name ?? profile?.username ?? "Unknown";
                  const id = item.id as string;
                  return (
                    <div
                      key={id}
                      className={`border p-3 space-y-2 transition-colors ${selected.has(id) ? "border-black" : "border-black/10"}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggle(id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <span className="text-[10px] text-stone-400 shrink-0 uppercase tracking-wide">
                              {TYPE_LABELS[item.notification_type as string] ?? item.notification_type}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 truncate mt-0.5">{item.email_subject as string}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancel(id)}
                          className="text-stone-300 hover:text-red-400 transition-colors shrink-0"
                          title="Cancel notification"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {toast && (
            <div className="fixed bottom-6 right-6 bg-black text-white text-xs px-4 py-2">
              {toast}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="sticky bottom-0 bg-background border-t border-black px-5 py-4">
            <button
              type="button"
              onClick={handleSend}
              disabled={selected.size === 0 || sending}
              className="flex items-center gap-2 w-full justify-center bg-black text-white text-sm py-2.5 hover:bg-black/80 transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? "Sending…" : `Send ${selected.size > 0 ? `${selected.size} ` : ""}notification${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
