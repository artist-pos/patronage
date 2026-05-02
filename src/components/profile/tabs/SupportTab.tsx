"use client";

import { useState, useTransition } from "react";
import { toggleSupportEnabled } from "@/app/profile/support-actions";
import { SupportCheckoutModal } from "@/components/profile/SupportCheckoutModal";
import type { SupportTier } from "@/types/database";

interface Props {
  supportEnabled: boolean;
  isOwner: boolean;
  artistName: string;
  tiers?: SupportTier[];
}

export function SupportTab({ supportEnabled: initialEnabled, isOwner, artistName, tiers = [] }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();
  const [selectedTier, setSelectedTier] = useState<SupportTier | null>(null);

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleSupportEnabled();
      if (!result.error) setEnabled((e) => !e);
    });
  }

  if (!enabled) {
    if (isOwner) {
      return (
        <div className="py-12 space-y-4 max-w-md">
          <h2 className="text-base font-semibold">Enable Support</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Allow patrons and collectors to support your practice through monthly tiers,
            one-time contributions, and print editions.
          </p>
          <button
            onClick={handleToggle}
            className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
          >
            Enable support
          </button>
        </div>
      );
    }
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">Support options coming soon.</p>
      </div>
    );
  }

  const activeTiers = tiers.filter(t => t.is_active);

  return (
    <div className="py-8 space-y-4">
      {isOwner && (
        <div className="flex justify-end items-center gap-4">
          <a
            href="/studio?section=support"
            className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            Manage tiers →
          </a>
          <button
            onClick={handleToggle}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Disable support
          </button>
        </div>
      )}

      {activeTiers.length === 0 ? (
        <div className="space-y-4">
          {isOwner ? (
            <p className="text-sm text-muted-foreground">
              No support tiers yet.{" "}
              <a href="/studio?section=support" className="underline underline-offset-2 hover:text-foreground">
                Add tiers in your profile settings →
              </a>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Support tiers coming soon.</p>
          )}
        </div>
      ) : (
        activeTiers.map(tier => (
          <div
            key={tier.id}
            className="border border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{tier.title}</h3>
              <p className="text-xs text-muted-foreground">
                NZD {tier.price.toLocaleString("en-NZ")}
                {tier.description ? ` — ${tier.description}` : ""}
              </p>
            </div>
            <button
              onClick={() => setSelectedTier(tier)}
              className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors whitespace-nowrap"
            >
              {isOwner ? "Configure →" : `Support ${artistName}`}
            </button>
          </div>
        ))
      )}

      {selectedTier && (
        <SupportCheckoutModal
          tier={selectedTier}
          artistName={artistName}
          onClose={() => setSelectedTier(null)}
        />
      )}
    </div>
  );
}
