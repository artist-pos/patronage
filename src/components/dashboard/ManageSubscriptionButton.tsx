"use client";

import { useState } from "react";
import { openSupportCustomerPortal } from "@/app/support/actions";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await openSupportCustomerPortal();
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (result.url) {
      window.location.href = result.url;
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50 transition-colors disabled:opacity-50"
      >
        {loading ? "Opening…" : "Manage →"}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
