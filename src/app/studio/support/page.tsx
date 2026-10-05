import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { SupportTiersManager } from "@/components/profile/SupportTiersManager";
import type { Metadata } from "next";
import type { SupportTier } from "@/types/database";

export const metadata: Metadata = { title: "Support — Studio" };

export default async function StudioSupportPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("stripe_connect_status")
    .eq("id", user.id)
    .single();

  const { data: tiersData } = await supabase
    .from("support_tiers")
    .select("*")
    .eq("profile_id", user.id)
    .order("sort_order", { ascending: true });

  const initialTiers = (tiersData ?? []) as SupportTier[];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Ways to Support Me</h2>
        <p className="text-xs text-muted-foreground">
          Set up the ways patrons can support your practice. Payments are coming soon — configure tiers now to capture early interest.
        </p>
      </div>
      {profileRow?.stripe_connect_status !== "enabled" && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-amber-900">Connect Stripe to start receiving payments</p>
            <p className="text-xs text-amber-800">
              Your tiers are visible on your profile, but supporters can&rsquo;t pay until your bank account is connected.
            </p>
          </div>
          <a
            href="/studio/connect"
            className="text-sm bg-black text-white px-4 py-2 rounded-lg hover:opacity-80 transition-opacity whitespace-nowrap text-center"
          >
            Connect Stripe →
          </a>
        </div>
      )}
      <SupportTiersManager initialTiers={initialTiers} />
    </div>
  );
}
