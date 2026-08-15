import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";

export function generateMetadata() {
  return generateHubMetadata("prizes");
}

export default function Page() {
  return <HubPage typeSlug="prizes" />;
}
