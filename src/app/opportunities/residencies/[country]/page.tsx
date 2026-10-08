import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";
import { RegionalHubPage, generateRegionalHubMetadata } from "@/components/opportunities/RegionalHubPage";
import { HUB_COUNTRY_MAP } from "@/lib/hub-content";

// One segment, two meanings: a country ("new-zealand") or a region ("waikato").
// Country slugs are a fixed list, so they are tried first.
interface Props {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { country } = await params;
  if (HUB_COUNTRY_MAP[country]) return generateHubMetadata("residencies", country);
  return generateRegionalHubMetadata("residencies", country);
}

export default async function Page({ params }: Props) {
  const { country } = await params;
  if (HUB_COUNTRY_MAP[country]) return <HubPage typeSlug="residencies" countrySlug={country} />;
  return <RegionalHubPage typeSlug="residencies" regionSlug={country} />;
}
