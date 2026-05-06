import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
import { ConnectForm } from "./ConnectForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect Bank — Studio — Patronage",
};

export default async function ConnectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username, stripe_connect_status")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/dashboard");
  }

  const status = profile.stripe_connect_status as string | null;

  return (
    <StudioPageShell username={profile.username} activeSection="earnings">
      <div className="max-w-lg space-y-8">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Connect your bank</h2>
          <p className="text-sm text-muted-foreground">
            Receive sale proceeds automatically via Stripe. Without connecting, payouts are processed manually by the Patronage team.
          </p>
        </div>

        {status === "enabled" ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 space-y-2">
            <p className="text-sm font-medium text-emerald-800">Bank account connected</p>
            <p className="text-xs text-emerald-700">
              Your Stripe account is active. Sale proceeds (90% of each sale) will be deposited automatically.
            </p>
          </div>
        ) : (
          <ConnectForm currentStatus={status} />
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Patronage uses <strong>Stripe Connect Express</strong> — your banking details are held by Stripe, not Patronage.</p>
          <p>You earn 90% of each sale. Patronage retains 10% as a commission.</p>
        </div>
      </div>
    </StudioPageShell>
  );
}
