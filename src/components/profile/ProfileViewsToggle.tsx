"use client";

import { updateProfileViewEmails } from "@/app/profile/privacy-actions";
import { EmailPrefToggle } from "./EmailPrefToggle";

export function ProfileViewsToggle({ initial }: { initial: boolean }) {
  return (
    <EmailPrefToggle
      initial={initial}
      title="Monday summary"
      onCopy="On Mondays we'll tell you how many people appreciated or saved your work and viewed your profile that week. Only you see these numbers."
      offCopy="Turn on to get a Monday email when people have appreciated, saved or viewed your work."
      onToast="Monday summary on."
      offToast="Monday summary off."
      save={updateProfileViewEmails}
    />
  );
}
