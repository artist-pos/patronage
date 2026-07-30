"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  updateId: string;
  initialHidden: boolean;
  /** `true` on image pins, where the control sits on a dark hover bar. */
  onDark?: boolean;
}

/**
 * Admin-only moderation control on a feed pin — hides / unhides the update on the
 * landing page and /feed for signed-out visitors (migration 177). Nothing else
 * changes: the post keeps its own page, its direct link, and its place on the
 * artist's profile and project thread. Rendered only when the viewer is an
 * admin/owner, so artists never see it and get no notification.
 *
 * Optimistic per the project convention: flip local state immediately, roll back
 * if the PATCH fails. No router.refresh() — the flag changes nothing for the
 * signed-in admin looking at the feed, so a refetch would only cost a round-trip.
 */
export function AdminHideToggle({ updateId, initialHidden, onDark = false }: Props) {
  const [hidden, setHidden] = useState(initialHidden);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;

    const next = !hidden;
    setHidden(next);
    setSaving(true);
    setFailed(false);

    try {
      const res = await fetch(`/api/admin/updates/${updateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_hidden: next }),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      setHidden(!next);
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const label = failed
    ? "Couldn't save — try again"
    : hidden
      ? "Hidden from the landing page and feed for signed-out visitors — click to unhide"
      : "Hide from the landing page and feed for signed-out visitors";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-label={label}
      aria-pressed={hidden}
      title={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors disabled:opacity-50 ${
        onDark ? "hover:bg-white/20" : "hover:bg-muted"
      } ${
        failed
          ? "text-destructive"
          : hidden
            ? onDark ? "text-white" : "text-foreground"
            : onDark ? "text-white/70" : "text-muted-foreground"
      }`}
    >
      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}
