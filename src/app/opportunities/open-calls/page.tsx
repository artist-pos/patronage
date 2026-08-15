import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";

export function generateMetadata() {
  return generateHubMetadata("open-calls");
}

export default function Page() {
  return <HubPage typeSlug="open-calls" />;
}
