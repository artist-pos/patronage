import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOpportunityDraft } from "./actions";

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewOpportunityPage({ searchParams }: Props) {
  const { type } = await searchParams;
  const listingType = type === "free" ? "free" : "pipeline";

  // Both listing types can be started before signing in — send logged-out users
  // to the matching anonymous wizard, which gates auth before the steps that
  // need a real opportunity id instead of at the door.
  {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect(listingType === "free" ? "/partner/list-free" : "/partner/list-pipeline");
  }

  const { id } = await createOpportunityDraft(listingType);
  const startStep = listingType === "free" ? 2 : 1;
  redirect(`/partner/opportunities/${id}/new?step=${startStep}&type=${listingType}`);
}
