import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";

export function generateMetadata() {
  return generateHubMetadata("jobs");
}

export default function Page() {
  return <HubPage typeSlug="jobs" />;
}
