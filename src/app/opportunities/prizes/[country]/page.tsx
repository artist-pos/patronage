import { notFound } from "next/navigation";
import { RegionalHubPage, generateRegionalHubMetadata } from "@/components/opportunities/RegionalHubPage";
import { HUB_COUNTRY_MAP } from "@/lib/hub-content";
import { DisciplineHubPage, generateDisciplineHubMetadata } from "@/components/opportunities/DisciplineHubPage";
import { isDisciplineSlug } from "@/lib/discipline-hubs";

// Prizes have no country-level editorial hubs, so the segment is always a region.
interface Props {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { country } = await params;
  if (isDisciplineSlug(country)) return generateDisciplineHubMetadata("prizes", country);
  return generateRegionalHubMetadata("prizes", country);
}

export default async function Page({ params }: Props) {
  const { country } = await params;
  if (HUB_COUNTRY_MAP[country]) notFound();
  if (isDisciplineSlug(country)) return <DisciplineHubPage typeSlug="prizes" disciplineSlug={country} />;
  return <RegionalHubPage typeSlug="prizes" regionSlug={country} />;
}
