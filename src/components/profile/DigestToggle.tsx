"use client";

import { useEffect, useState } from "react";
import { updateDigestSubscription } from "@/app/profile/privacy-actions";

interface Props {
  initial: boolean;
  /** When true, silently syncs the subscription on mount (used for artists whose db value is null) */
  autoSync?: boolean;
}

export function DigestToggle({ initial, autoSync }: Props) {
  const [subscribed, setSubscribed] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Silently subscribe on mount when the db value was null and we defaulted to true
  useEffect(() => {
    if (autoSync && initial) {
      updateDigestSubscription(true).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    const next = !subscribed;
    setSubscribed(next);
    setSaving(true);
    const result = await updateDigestSubscription(next);
    setSaving(false);
    if (result?.error) {
      setSubscribed(!next);
      setToast(result.error);
    } else {
      setToast(next ? "Subscribed to weekly digest." : "Unsubscribed from weekly digest.");
    }
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Weekly Digest</p>
        <p className="text-xs text-muted-foreground">
          {subscribed
            ? "You are subscribed. We'll send new and closing-soon opportunities to your inbox each week."
            : "Subscribe to receive new and closing-soon opportunities in your inbox each week."}
        </p>
        {toast && (
          <p className="text-xs text-muted-foreground mt-1">{toast}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={subscribed}
        onClick={toggle}
        disabled={saving}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          subscribed ? "bg-black" : "bg-stone-200",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            subscribed ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
