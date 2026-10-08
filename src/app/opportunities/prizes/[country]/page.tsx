import { notFound } from "next/navigation";
import { RegionalHubPage, generateRegionalHubMetadata } from "@/components/opportunities/RegionalHubPage";
import { HUB_COUNTRY_MAP } from "@/lib/hub-content";

// Prizes have no country-level editorial hubs, so the segment is always a region.
interface Props {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { country } = await params;
  return generateRegionalHubMetadata("prizes", country);
}

export default async function Page({ params }: Props) {
  const { country } = await params;
  if (HUB_COUNTRY_MAP[country]) notFound();
  return <RegionalHubPage typeSlug="prizes" regionSlug={country} />;
}
