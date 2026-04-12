"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import type { SupportTierType } from "@/types/database";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function createSupportTier(data: {
  title: string;
  price: number;
  description?: string;
  tier_type?: SupportTierType;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title is required" };
  if (data.price <= 0) return { error: "Price must be greater than 0" };

  const { data: existing } = await supabase
    .from("support_tiers")
    .select("sort_order")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("support_tiers").insert({
    profile_id: user.id,
    title: data.title.trim(),
    price: data.price,
    description: data.description?.trim() || null,
    tier_type: data.tier_type ?? null,
    sort_order: nextOrder,
  });

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
  return {};
}

export async function updateSupportTier(
  tierId: string,
  data: { title: string; price: number; description?: string; tier_type?: SupportTierType | null }
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!data.title.trim()) return { error: "Title is required" };
  if (data.price <= 0) return { error: "Price must be greater than 0" };

  const { error } = await supabase
    .from("support_tiers")
    .update({
      title: data.title.trim(),
      price: data.price,
      description: data.description?.trim() || null,
      tier_type: data.tier_type ?? null,
    })
    .eq("id", tierId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
  return {};
}

export async function deleteSupportTier(tierId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("support_tiers")
    .delete()
    .eq("id", tierId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
  return {};
}

export async function toggleSupportTierActive(tierId: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("support_tiers")
    .update({ is_active: isActive })
    .eq("id", tierId)
    .eq("profile_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/profile/edit");
  return {};
}

export async function registerSupportIntent(
  tierId: string,
  email: string
): Promise<{ error?: string }> {
  if (!email.trim() || !email.includes("@")) return { error: "Please enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.from("support_intents").insert({
    tier_id: tierId,
    email: email.trim().toLowerCase(),
  });

  if (error) return { error: error.message };
  return {};
}

// ── Intent dashboard ─────────────────────────────────────────────────────────

export async function getSupportIntentsForProfile(): Promise<{
  intents?: Array<{ id: string; tier_id: string; email: string; created_at: string }>;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Join via support_tiers to scope to this artist only
  const { data, error } = await supabase
    .from("support_intents")
    .select("id, tier_id, email, created_at, support_tiers!inner(profile_id)")
    .eq("support_tiers.profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  return {
    intents: ((data ?? []) as unknown as Array<{ id: string; tier_id: string; email: string; created_at: string }>),
  };
}

// ── Broadcast email to all supporters ────────────────────────────────────────

export async function broadcastToSupporters(message: string): Promise<{ sent?: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!message.trim()) return { error: "Message cannot be empty." };

  // Fetch artist profile for display name + get all unique supporter emails
  const admin = createAdminClient();
  const [{ data: profile }, { data: intents }] = await Promise.all([
    admin.from("profiles").select("full_name, username").eq("id", user.id).single(),
    admin
      .from("support_intents")
      .select("email, support_tiers!inner(profile_id)")
      .eq("support_tiers.profile_id", user.id),
  ]);

  const artistName = profile?.full_name ?? profile?.username ?? "An artist on Patronage";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

  // Deduplicate emails
  const emails = [...new Set((intents ?? []).map((i: { email: string }) => i.email))];
  if (emails.length === 0) return { sent: 0 };

  const resend = getResend();

  // Send in batches of 50 (Resend batch limit)
  let sent = 0;
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50);
    await resend.batch.send(
      batch.map(email => ({
        from: `Patronage <noreply@patronage.nz>`,
        to: email,
        subject: `A message from ${artistName}`,
        html: `
          <p style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111;">
            ${message.replace(/\n/g, "<br/>")}
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="font-family:sans-serif;font-size:12px;color:#888;">
            You're receiving this because you expressed interest in supporting
            <strong>${artistName}</strong> on Patronage.<br/>
            <a href="${siteUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color:#888;">Unsubscribe</a>
          </p>
        `,
      }))
    );
    sent += batch.length;
  }

  return { sent };
}
