"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export async function createConnectAccountLink(): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, stripe_account_id, stripe_connect_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    return { error: "Artists only." };
  }

  const stripe = getStripe();
  let accountId = profile.stripe_account_id;

  // Create a new Express account if this artist doesn't have one yet
  if (!accountId) {
    const account = await stripe.accounts.create({ type: "express" });
    accountId = account.id;
    await admin
      .from("profiles")
      .update({ stripe_account_id: accountId, stripe_connect_status: "pending" })
      .eq("id", user.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${SITE_URL}/studio/connect`,
    return_url: `${SITE_URL}/studio/connect/return`,
    type: "account_onboarding",
  });

  return { url: link.url };
}

export async function syncConnectStatus(): Promise<{ status?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_account_id) return { error: "No Stripe account found." };

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(profile.stripe_account_id);
  const status = account.charges_enabled ? "enabled" : "pending";

  await admin
    .from("profiles")
    .update({ stripe_connect_status: status })
    .eq("id", user.id);

  return { status };
}
