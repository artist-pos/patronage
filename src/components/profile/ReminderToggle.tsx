"use client";

import { updateDeadlineReminders } from "@/app/profile/privacy-actions";
import { EmailPrefToggle } from "./EmailPrefToggle";

export function ReminderToggle({ initial }: { initial: boolean }) {
  return (
    <EmailPrefToggle
      initial={initial}
      title="Deadline reminders"
      onCopy="We'll email you a week and two days before an opportunity you saved closes."
      offCopy="Turn on to get an email a week and two days before opportunities you saved close."
      onToast="Deadline reminders on."
      offToast="Deadline reminders off."
      save={updateDeadlineReminders}
    />
  );
}
