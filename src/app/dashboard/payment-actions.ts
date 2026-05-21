"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentRequest } from "@/lib/email";

export async function requestPayment(params: {
  applicationId: string;
  accountHolder: string;
  bankAccount: string;
  gstRegistered: boolean;
  gstNumber: string | null;
  amount: number;
  description: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("id, artist_id, opportunity_id, status")
    .eq("id", params.applicationId)
    .eq("artist_id", user.id)
    .single();

  if (!app) return { error: "Application not found" };
  if ((app.status as string) !== "production_ready") return { error: "Payment can only be requested at production ready stage" };
  if (params.amount <= 0) return { error: "Amount must be greater than zero" };

  const admin = createAdminClient();

  const [{ data: oppData }, { data: artistProfile }] = await Promise.all([
    admin
      .from("opportunities")
      .select("title, profile_id")
      .eq("id", app.opportunity_id as string)
      .single(),
    admin
      .from("profiles")
      .select("full_name, username, gst_registered, gst_number")
      .eq("id", user.id)
      .single(),
  ]);

  if (!oppData) return { error: "Opportunity not found" };

  // Get partner email via their profile_id
  const { data: partnerAuth } = await admin.auth.admin.getUserById(oppData.profile_id as string);
  if (!partnerAuth?.user?.email) return { error: "Could not find partner contact" };

  const { data: artistAuth } = await admin.auth.admin.getUserById(user.id);
  if (!artistAuth?.user?.email) return { error: "Could not find artist email" };

  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";

  await sendPaymentRequest({
    partnerEmail: partnerAuth.user.email,
    artistEmail: artistAuth.user.email,
    artistName,
    opportunityTitle: (oppData as { title: string }).title,
    params: {
      accountHolder: params.accountHolder,
      bankAccount: params.bankAccount,
      gstRegistered: params.gstRegistered,
      gstNumber: params.gstNumber,
      amount: params.amount,
      description: params.description,
    },
  });

  const { error } = await supabase
    .from("opportunity_applications")
    .update({
      invoice_requested_at: new Date().toISOString(),
      invoice_amount: params.amount,
    })
    .eq("id", params.applicationId);

  if (error) return { error: error.message };
  return {};
}

export async function sendRejectionReplyAction(params: {
  applicationId: string;
  message: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: app } = await supabase
    .from("opportunity_applications")
    .select("id, artist_id, opportunity_id, status, rejection_reply_sent_at")
    .eq("id", params.applicationId)
    .eq("artist_id", user.id)
    .single();

  if (!app) return { error: "Application not found" };
  if ((app.status as string) !== "rejected") return { error: "Can only reply to rejected applications" };
  if (app.rejection_reply_sent_at) return { error: "Reply already sent" };

  const admin = createAdminClient();

  const { data: oppData } = await admin
    .from("opportunities")
    .select("title, profile_id")
    .eq("id", app.opportunity_id as string)
    .single();

  if (!oppData) return { error: "Opportunity not found" };

  const { data: partnerAuth } = await admin.auth.admin.getUserById(oppData.profile_id as string);
  if (!partnerAuth?.user?.email) return { error: "Could not find partner contact" };

  const { data: artistProfile } = await admin
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .single();
  const artistName = artistProfile?.full_name ?? artistProfile?.username ?? "Artist";

  const { sendRejectionReply } = await import("@/lib/email");
  await sendRejectionReply({
    partnerEmail: partnerAuth.user.email,
    artistName,
    opportunityTitle: (oppData as { title: string }).title,
    message: params.message,
  });

  const { error } = await supabase
    .from("opportunity_applications")
    .update({ rejection_reply_sent_at: new Date().toISOString() })
    .eq("id", params.applicationId);

  if (error) return { error: error.message };
  return {};
}
