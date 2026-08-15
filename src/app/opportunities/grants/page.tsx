import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";

export function generateMetadata() {
  return generateHubMetadata("grants");
}

export default function Page() {
  return <HubPage typeSlug="grants" />;
}
