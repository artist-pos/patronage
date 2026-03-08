"use client";

import { track } from "@vercel/analytics";
import { trackEvent } from "@/actions/trackEvent";

interface Props {
  href: string;
  opportunityId: string;
  title: string;
  organiser: string;
  label?: string;
  className?: string;
}

export function OpportunityCTALink({ href, opportunityId, title, organiser, label, className }: Props) {
  function handleClick() {
    track("view_opportunity", { title, organiser });
    trackEvent("opportunity_click", { opportunity_id: opportunityId, title, organiser });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className ?? "text-xs underline underline-offset-2 mt-auto hover:text-muted-foreground transition-colors"}
    >
      {label ?? "View opportunity →"}
    </a>
  );
}
