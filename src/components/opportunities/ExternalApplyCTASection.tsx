"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { track } from "@vercel/analytics";
import { trackEvent } from "@/lib/analytics";
import { withUtm } from "@/lib/utm";
import { BlakeNote } from "@/components/auth/BlakeNote";

const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

const POST_SIGNUP_DESTINATION = "/opportunities?tab=for-you";

interface ApplyLink {
  label: string | null;
  url: string;
}

interface Props {
  applyLinks: ApplyLink[];
  opportunityId: string;
  title: string;
  organiser: string;
  isAuthenticated: boolean;
}

/**
 * First click intercepts the apply link and shows the signup prompt while
 * focus stays on this tab — signed-out visitors only. The external link
 * opens once they sign up, dismiss, or click "Just apply".
 * Logged-in users get the link directly with no interstitial.
 */
export function ExternalApplyCTASection({ applyLinks, opportunityId, title, organiser, isAuthenticated }: Props) {
  const [open, setOpen] = useState(false);
  // The link href that triggered the modal — opened once they proceed.
  const pendingUrl = useRef<string | null>(null);

  function handleApplyClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (isAuthenticated) return; // let the link open normally
    e.preventDefault();
    track("view_opportunity", { title, organiser });
    trackEvent("opportunity_click", { opportunity_id: opportunityId, title, organiser });
    pendingUrl.current = withUtm(href, { campaign: "opportunity_listing", content: opportunityId });
    setOpen(true);
    trackEvent("before_you_go_modal_shown", { opportunity_id: opportunityId });
  }

  function proceed() {
    const url = pendingUrl.current;
    setOpen(false);
    pendingUrl.current = null;
    if (url) {
      const opened = window.open(url, "_blank");
      if (opened) opened.opener = null;
      else window.location.href = url;
    }
  }

  function dismiss() {
    trackEvent("before_you_go_modal_dismissed", { opportunity_id: opportunityId });
    proceed();
  }

  return (
    <>
      {applyLinks.map((link, i) => {
        const href = withUtm(link.url, { campaign: "opportunity_listing", content: opportunityId });
        return (
          <a
            key={`${link.url}-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => handleApplyClick(e, link.url)}
            className={
              i === 0
                ? "inline-flex items-center gap-2 bg-brand px-[22px] py-3 text-sm font-medium text-white transition-opacity hover:opacity-85"
                : "inline-flex items-center gap-2 border border-border px-[22px] py-3 text-sm font-medium text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
            }
          >
            {link.label?.trim() || "Apply"} →
          </a>
        );
      })}

      {open && (
        <SignupPromptModal
          source="before_you_go_external_apply"
          eventPrefix="before_you_go_modal"
          opportunityId={opportunityId}
          heading="Before you go — what do you make?"
          intro={
            <div className="text-foreground">
              <BlakeNote>
                I built Patronage to make finding the next opportunity a little easier. Make a free profile and
                I&rsquo;ll send you the best ones each week.
              </BlakeNote>
            </div>
          }
          chipsLabel="What do you make?"
          submitLabel="Create my free profile →"
          next={POST_SIGNUP_DESTINATION}
          onClose={dismiss}
          skipLabel="Just apply →"
          onSkip={proceed}
        />
      )}
    </>
  );
}
