import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";

export function generateMetadata() {
  return generateHubMetadata("residencies");
}

export default function Page() {
  return <HubPage typeSlug="residencies" />;
}
