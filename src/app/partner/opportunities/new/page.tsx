import { redirect } from "next/navigation";
import { createOpportunityDraft } from "./actions";

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewOpportunityPage({ searchParams }: Props) {
  const { type } = await searchParams;
  const listingType = type === "free" ? "free" : "pipeline";
  const { id } = await createOpportunityDraft(listingType);
  const startStep = listingType === "free" ? 2 : 1;
  redirect(`/partner/opportunities/${id}/new?step=${startStep}&type=${listingType}`);
}
