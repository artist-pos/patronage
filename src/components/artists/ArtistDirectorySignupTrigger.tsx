"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { BlakeNote } from "@/components/auth/BlakeNote";

const SignupPromptModal = dynamic(() => import("@/components/auth/SignupPromptModal"), { ssr: false });

const POST_SIGNUP_DESTINATION = "/artists";

/**
 * Invisible sentinel placed after the directory cards. Once it scrolls into
 * view for a signed-out visitor the signup prompt opens. Fires once per
 * page view — no session suppression so it shows on every visit.
 */
export function ArtistDirectorySignupTrigger() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !shownRef.current) {
          shownRef.current = true;
          setOpen(true);
          trackEvent("artists_directory_signup_modal_view", {});
          observer.disconnect();
        }
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  function close() {
    setOpen(false);
    trackEvent("artists_directory_signup_modal_dismissed", {});
  }

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      {open && (
        <SignupPromptModal
          source="artists_directory_modal"
          eventPrefix="artists_directory_signup_modal"
          heading="What do you make?"
          intro={
            <>
              Make a free profile and join the directory. We&rsquo;ll match you with grants, residencies, commissions
              and open calls that fit your practice.
            </>
          }
          note={
            <BlakeNote>
              I built Patronage to make it easier for artists to find opportunities and get their work seen. Join for
              free.
            </BlakeNote>
          }
          submitLabel="Join the directory →"
          next={POST_SIGNUP_DESTINATION}
          onClose={close}
        />
      )}
    </>
  );
}
