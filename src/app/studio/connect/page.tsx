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
            Link your bank account via Stripe to receive payouts automatically — sales, support, and royalties all deposit directly.
          </p>
        </div>

        {status === "enabled" ? (
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 space-y-2">
            <p className="text-sm font-medium text-emerald-800">Bank account connected</p>
            <p className="text-xs text-emerald-700">
              Your Stripe account is active. Payouts deposit automatically after each transaction.
            </p>
          </div>
        ) : (
          <ConnectForm currentStatus={status} />
        )}

        {/* Fee structure */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-stone-50 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">How splits work</p>
          </div>
          <div className="divide-y divide-border">
            <div className="px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-4 text-sm">
              <span className="text-stone-700">Work sales</span>
              <span className="font-medium">90% to you</span>
              <span className="text-muted-foreground text-xs self-center">10% to Patronage</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-4 text-sm">
              <span className="text-stone-700">Subscriptions &amp; support</span>
              <span className="font-medium">95% to you</span>
              <span className="text-muted-foreground text-xs self-center">5% to Patronage</span>
            </div>
            <div className="px-4 py-3 space-y-1">
              <div className="grid grid-cols-[1fr_auto] gap-4 text-sm">
                <span className="text-stone-700">Campaign revenue</span>
                <span className="font-medium text-stone-500">Varies per campaign</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Campaign splits are set individually to support flexible models — charitable giving, community funds, or
                sustainable production (e.g. a percentage of a mural&apos;s print sales directed to a mural fund).
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Patronage uses <strong>Stripe Connect Express</strong> — your banking details are held by Stripe, not Patronage.
        </p>
      </div>
    </StudioPageShell>
  );
}
