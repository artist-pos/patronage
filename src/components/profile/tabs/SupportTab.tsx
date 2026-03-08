"use client";

import { useState, useTransition } from "react";
import { toggleSupportEnabled } from "@/app/profile/support-actions";

interface Props {
  supportEnabled: boolean;
  isOwner: boolean;
  artistName: string;
}

export function SupportTab({ supportEnabled: initialEnabled, isOwner, artistName }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [, startTransition] = useTransition();

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

  const sections = [
    {
      title: "Monthly Support",
      description: `Support ${artistName}'s practice with a recurring monthly contribution.`,
    },
    {
      title: "One-time Support",
      description: "Make a one-time contribution to support a specific project or purchase.",
    },
    {
      title: "Editions & Prints",
      description: "Limited edition prints and artist multiples available for purchase.",
    },
    {
      title: "Membership",
      description: "Join the inner circle with access to exclusive updates and early previews.",
    },
  ];

  return (
    <div className="py-8 space-y-4">
      {isOwner && (
        <div className="flex justify-end">
          <button
            onClick={handleToggle}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Disable support
          </button>
        </div>
      )}
      {sections.map((section) => (
        <div
          key={section.title}
          className="border border-border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
          <div className="relative group">
            <button
              disabled
              className="text-sm border border-black px-4 py-2 opacity-40 cursor-not-allowed whitespace-nowrap"
            >
              {isOwner ? "Configure →" : `Support ${artistName}`}
            </button>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-foreground text-background text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Stripe integration coming soon
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
