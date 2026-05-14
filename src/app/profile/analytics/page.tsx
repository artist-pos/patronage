import { redirect } from "next/navigation";

export default function ProfileAnalyticsPage() {
  redirect("/studio?section=analytics");
}
