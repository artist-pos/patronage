import { redirect } from "next/navigation";

// The organiser's dashboard lives at /dashboard.
export default function PartnerDashboardRedirect() {
  redirect("/dashboard");
}
