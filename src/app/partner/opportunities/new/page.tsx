import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createOpportunityDraft } from "./actions";

interface Props {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewOpportunityPage({ searchParams }: Props) {
  const { type } = await searchParams;
  const listingType = type === "free" ? "free" : "pipeline";

  // Free listings can be filled out before signing in — send logged-out users to
  // the anonymous wizard, which gates auth at submit instead of at the door.
  if (listingType === "free") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/partner/list-free");
  }

  const { id } = await createOpportunityDraft(listingType);
  const startStep = listingType === "free" ? 2 : 1;
  redirect(`/partner/opportunities/${id}/new?step=${startStep}&type=${listingType}`);
}
