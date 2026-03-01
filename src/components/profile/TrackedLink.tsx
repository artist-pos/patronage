"use client";

import { trackEvent } from "@/actions/trackEvent";

interface Props {
  href: string;
  profileId: string;
  eventType: "cv_click" | "website_click" | "bib_click";
  username: string;
  className?: string;
  children: React.ReactNode;
}

export function TrackedLink({ href, profileId, eventType, username, className, children }: Props) {
  function handleClick() {
    trackEvent(eventType, { profile_id: profileId, username });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
}
