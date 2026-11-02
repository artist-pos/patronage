"use client";

import { updateOpportunityAlerts } from "@/app/profile/privacy-actions";
import { EmailPrefToggle } from "./EmailPrefToggle";

export function OrgAlertsToggle({ initial }: { initial: boolean }) {
  return (
    <EmailPrefToggle
      initial={initial}
      title="Organisations you follow"
      onCopy="We'll email you when an organisation you follow posts a new opportunity."
      offCopy="Turn on to get an email when an organisation you follow posts a new opportunity."
      onToast="Organisation alerts on."
      offToast="Organisation alerts off."
      save={updateOpportunityAlerts}
    />
  );
}
