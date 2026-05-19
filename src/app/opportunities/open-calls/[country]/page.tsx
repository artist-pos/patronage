import { notFound } from "next/navigation";
import { HubPage, generateHubMetadata } from "@/components/opportunities/HubPage";
import { HUB_COUNTRY_MAP } from "@/lib/hub-content";

interface Props {
  params: Promise<{ country: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { country } = await params;
  return generateHubMetadata("open-calls", country);
}

export default async function Page({ params }: Props) {
  const { country } = await params;
  if (!HUB_COUNTRY_MAP[country]) notFound();
  return <HubPage typeSlug="open-calls" countrySlug={country} />;
}
