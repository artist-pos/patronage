import { redirect } from "next/navigation";

// /onboarding is no longer the profile-edit page.
// Existing bookmarks and email links land here and are forwarded cleanly.
export default function OnboardingRedirect() {
  redirect("/settings");
}
