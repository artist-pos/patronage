"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initiatePipelineActivation } from "./actions";

interface Props {
  params: Promise<{ id: string }>;
}

export default function ActivatePage({ params }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleActivate() {
    const { id } = await params;
    setLoading(true);
    setError(null);
    const result = await initiatePipelineActivation(id);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    if (result.checkoutUrl) window.location.href = result.checkoutUrl;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Pipeline activation</p>
          <h1 className="text-2xl font-semibold tracking-tight">Activate your pipeline</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Your listing has been submitted for review. To activate the full application pipeline,
            a one-off payment of <strong>$200 NZD</strong> is required.
            Your first pipeline round is free — this applies from your second listing onwards.
          </p>
        </div>

        <div className="border border-black p-5 space-y-4">
          <div className="space-y-2">
            {[
              "Custom application questions",
              "Kanban, Table, and Triage pipeline views",
              "Committee scoring and rubric builder",
              "Staged artist notifications",
              "Production asset delivery",
              "6 and 12-month impact reporting",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-sm">
                <span className="text-stone-300 shrink-0 mt-0.5">–</span>
                <span className="text-stone-600">{item}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-black/10 pt-4 flex items-baseline justify-between">
            <span className="text-sm text-stone-500">Pipeline activation</span>
            <span className="text-lg font-semibold">$200 NZD</span>
          </div>
          <p className="text-[11px] text-stone-400">+ 2.9% + 30c card processing fee (Stripe)</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleActivate}
            disabled={loading}
            className="w-full bg-black text-white text-sm px-6 py-3 font-medium hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            {loading ? "Redirecting to payment…" : "Pay and activate →"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/partner/dashboard")}
            className="w-full text-sm text-stone-500 hover:text-foreground transition-colors py-2"
          >
            Skip for now — go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
