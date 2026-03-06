"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendApplicationConfirmation } from "@/lib/email";

export async function updateOpportunityAdmin(
  id: string,
  data: {
    caption?: string | null;
    full_description?: string | null;
    url?: string | null;
    type?: string;
    country?: string;
    featured_image_url?: string | null;
    sub_categories?: string[] | null;
    opens_at?: string | null;
    deadline?: string | null;
    funding_range?: string | null;
    entry_fee?: number | null;
    artist_payment_type?: string | null;
    travel_support?: boolean | null;
    travel_support_details?: string | null;
  }
) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();
  const { error } = await admin.from("opportunities").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
}

export async function submitApplication(
  opportunityId: string,
  artworkId: string | null,
  answers: Record<string, string>,
  submittedImageUrl?: string | null
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("opportunity_applications")
    .insert({
      opportunity_id: opportunityId,
      artist_id: user.id,
      artwork_id: artworkId || null,
      submitted_image_url: submittedImageUrl || null,
      custom_answers: answers,
    });

  if (error) return { error: error.message };

  // Send confirmation email fire-and-forget
  const admin = createAdminClient();
  const [authResult, { data: opp }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(user.id),
    admin.from("opportunities").select("title, organiser, profile_id").eq("id", opportunityId).single(),
    admin.from("profiles").select("full_name, username").eq("id", user.id).single(),
  ]);

  const authUser = authResult.data?.user ?? null;
  if (authUser?.email && opp) {
    const artistName = profile?.full_name ?? profile?.username ?? "Artist";
    const partnerName = opp.organiser;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";
    sendApplicationConfirmation(
      authUser.email,
      artistName,
      opp.title,
      partnerName,
      `${siteUrl}/dashboard?tab=applications`
    ).catch(console.error);
  }

  revalidatePath(`/opportunities/${opportunityId}`);
  revalidatePath("/dashboard");
  return {};
}

export async function rejectOpportunityAdmin(id: string) {
  if (!(await isAdmin())) throw new Error("Not authorised");
  const admin = createAdminClient();
  await admin
    .from("opportunities")
    .update({ status: "rejected", is_active: false })
    .eq("id", id);
  revalidatePath("/opportunities");
  redirect("/opportunities");
}
