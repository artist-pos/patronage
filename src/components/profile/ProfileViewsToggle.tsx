"use client";

import { updateProfileViewEmails } from "@/app/profile/privacy-actions";
import { EmailPrefToggle } from "./EmailPrefToggle";

export function ProfileViewsToggle({ initial }: { initial: boolean }) {
  return (
    <EmailPrefToggle
      initial={initial}
      title="Weekly profile views"
      onCopy="On Mondays we'll tell you how many people viewed your profile that week, when it was a few or more."
      offCopy="Turn on to get a Monday email when people have viewed your profile."
      onToast="Weekly profile views on."
      offToast="Weekly profile views off."
      save={updateProfileViewEmails}
    />
  );
}
