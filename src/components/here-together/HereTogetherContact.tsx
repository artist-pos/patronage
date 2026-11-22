"use client";

import { useEffect, useState } from "react";
import { PartnerContactForm } from "@/components/partners/PartnerContactForm";

export const INTEREST_EVENT = "ht:interest";

/** The site's partner contact form, pre-filled when someone taps "Express interest" on a calendar event. */
export function HereTogetherContact() {
  const [prefill, setPrefill] = useState<string | undefined>();

  useEffect(() => {
    function onInterest(e: Event) {
      const text = (e as CustomEvent<string>).detail;
      setPrefill(text);
    }
    window.addEventListener(INTEREST_EVENT, onInterest);
    return () => window.removeEventListener(INTEREST_EVENT, onInterest);
  }, []);

  return <PartnerContactForm defaultInterest="Here Together" prefill={prefill} />;
}
