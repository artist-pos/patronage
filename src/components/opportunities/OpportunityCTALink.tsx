"use client";

import { track } from "@vercel/analytics";
import { trackEvent } from "@/lib/analytics";
import { withUtm } from "@/lib/utm";

interface Props {
  href: string;
  opportunityId: string;
  title: string;
  organiser: string;
  label?: string;
  className?: string;
  /** Runs after the click is tracked — e.g. showing a retention prompt on
   *  this (now left-behind) tab, since the link itself opens in a new one. */
  onAfterClick?: () => void;
}

export function OpportunityCTALink({ href, opportunityId, title, organiser, label, className, onAfterClick }: Props) {
  // Tag the outbound link so the organiser's analytics can see the referral.
  const outbound = withUtm(href, { campaign: "opportunity_listing", content: opportunityId });

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    track("view_opportunity", { title, organiser });
    trackEvent("opportunity_click", { opportunity_id: opportunityId, title, organiser });

    // `target="_blank"` alone isn't reliable everywhere — some in-app browsers
    // (Instagram's especially) hijack it into a same-tab navigation, which
    // kills this tab (and the retention prompt onAfterClick shows here)
    // before it ever renders. Forcing it via window.open keeps this tab put
    // regardless of the embedding browser; a location.href fallback only
    // fires if that's somehow blocked, so the click never dead-ends.
    e.preventDefault();
    const opened = window.open(outbound, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = outbound;

    onAfterClick?.();
  }

  return (
    <a
      href={outbound}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className ?? "text-xs underline underline-offset-2 mt-auto hover:text-muted-foreground transition-colors"}
    >
      {label ?? "View opportunity →"}
    </a>
  );
}
