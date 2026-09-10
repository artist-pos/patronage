import { permanentRedirect } from "next/navigation";

// The role picker now lives on the signup page itself, which renders it
// whenever no role is set. This route is kept as a redirect because it has been
// linked from emails and may be bookmarked.
export default function GetStartedPage() {
  permanentRedirect("/auth/signup");
}
