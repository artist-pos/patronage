"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  profileId: string;
  initialGstRegistered?: boolean;
  initialGstNumber?: string | null;
}

export function PaymentsSection({ profileId, initialGstRegistered = false, initialGstNumber = null }: Props) {
  const [gstRegistered, setGstRegistered] = useState(initialGstRegistered);
  const [gstNumber, setGstNumber] = useState(initialGstNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (gstRegistered && gstNumber && !/^\d{8,9}$/.test(gstNumber.trim())) {
      setError("GST number must be 8–9 digits.");
      return;
    }
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("profiles")
      .update({
        gst_registered: gstRegistered,
        gst_number: gstRegistered && gstNumber.trim() ? gstNumber.trim() : null,
      })
      .eq("id", profileId);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
    } else {
      setToast("Saved");
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Payments</h2>
        <p className="text-xs text-muted-foreground">
          Payment details are pre-filled when you send a payment request to an organiser. Your bank account number is never stored — only GST registration status is saved here.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={gstRegistered}
              onChange={(e) => setGstRegistered(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <span className="text-sm font-medium">GST registered</span>
          </label>
          <p className="text-xs text-muted-foreground pl-6">
            If registered, your GST number will be included in payment requests sent to organisers.
          </p>
        </div>

        {gstRegistered && (
          <div className="space-y-1.5 pl-6">
            <label className="text-sm font-medium">GST number</label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              placeholder="123456789"
              className="w-full text-sm border border-black/30 px-3 py-2 focus:outline-none focus:border-black max-w-xs"
            />
            <p className="text-xs text-muted-foreground">8–9 digits, no spaces or dashes.</p>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : toast ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
