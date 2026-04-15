import { permanentRedirect } from "next/navigation";

// /dashboard/works has moved to /studio
export default function DashboardWorksRedirect() {
  permanentRedirect("/studio");
}
