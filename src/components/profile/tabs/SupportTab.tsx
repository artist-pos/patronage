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
  userEmail?: string;
  /**
   * Whether the artist has an active Stripe Connect account (charges enabled).
   * Derived from profiles.stripe_connect_status === "enabled" — no live Stripe
   * call. When false, payment buttons are replaced with an "unavailable" note
   * for visitors; tiers and pricing stay visible.
   */
  stripeConnected?: boolean;
}

export function SupportTab({ supportEnabled: initialEnabled, isOwner, artistName, tiers = [], userEmail, stripeConnected = false }: Props) {
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
            className="border border-foreground px-4 py-2 font-mono text-xs transition-colors hover:bg-foreground hover:text-white"
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
      <div className="flex items-center justify-between gap-4">
        <h2 className="t-section-label">Support</h2>
      </div>
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
        /* Tier cards — white pins in a grid: name, mono price, description,
           CTA anchored to the bottom edge */
        <div className="grid grid-cols-1 gap-2 bg-feed-bg p-2 sm:grid-cols-2 lg:grid-cols-3">
        {activeTiers.map(tier => {
          const isRecurring = tier.tier_type === "recurring";
          return (
          <div key={tier.id} className="flex flex-col bg-card p-5">
            {tier.tier_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tier.tier_image_url}
                alt={tier.title}
                className="mb-4 h-32 w-full object-cover"
              />
            )}
            <h3 className="text-[15px] font-semibold leading-snug">{tier.title}</h3>
            <p className="mt-1.5 font-mono text-lg font-semibold">
              NZD {tier.price.toLocaleString("en-NZ")}
              {isRecurring && (
                <span className="text-[11px] font-normal text-muted-foreground"> / month</span>
              )}
            </p>
            {tier.description && (
              <p className="mt-2 text-[13px] leading-[1.55] text-[color:var(--fg-muted)]">
                {tier.description}
              </p>
            )}
            <div className="mt-auto pt-4">
              {isOwner ? (
                <a
                  href="/studio?section=support"
                  className="inline-block border border-foreground px-4 py-2 font-mono text-xs transition-colors hover:bg-foreground hover:text-white"
                >
                  Configure →
                </a>
              ) : tier.tier_type === "service" || tier.tier_type === "project" ? (
                <a
                  href="/messages"
                  className="inline-block border border-foreground px-4 py-2 font-mono text-xs transition-colors hover:bg-foreground hover:text-white"
                >
                  Get in touch →
                </a>
              ) : stripeConnected ? (
                <button
                  onClick={() => setSelectedTier(tier)}
                  className="w-full bg-brand px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  {`Support ${artistName}`}
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Support payments coming soon
                </span>
              )}
            </div>
          </div>
          );
        })}
        </div>
      )}

      {!isOwner && selectedTier && (
        <SupportCheckoutModal
          tier={selectedTier}
          artistName={artistName}
          prefilledEmail={userEmail}
          onClose={() => setSelectedTier(null)}
        />
      )}
    </div>
  );
}
