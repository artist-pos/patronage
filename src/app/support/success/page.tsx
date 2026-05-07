import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/commerce-fee";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support confirmed — Patronage",
};

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SupportSuccessPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sessionId = sp.session_id ?? null;

  let summary: {
    artistName: string;
    artistUsername: string | null;
    isRecurring: boolean;
    pricePaidLabel: string;
    paid: boolean;
  } | null = null;

  if (sessionId) {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("support_subscriptions")
      .select("recipient_id, status, tier_type, buyer_paid_total_cents, currency")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (sub) {
      const { data: artist } = await admin
        .from("profiles")
        .select("full_name, username")
        .eq("id", sub.recipient_id)
        .maybeSingle();
      summary = {
        artistName: artist?.full_name ?? artist?.username ?? "the artist",
        artistUsername: artist?.username ?? null,
        isRecurring: sub.tier_type === "recurring",
        pricePaidLabel: formatCents(sub.buyer_paid_total_cents, sub.currency),
        paid: sub.status === "active" || sub.status === "one_off_paid",
      };
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-16">
      <div className="max-w-xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-emerald-700">Thank you</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {summary
              ? summary.isRecurring
                ? `You're now supporting ${summary.artistName}`
                : `Thanks for supporting ${summary.artistName}`
              : "Thanks for your support"}
          </h1>
          {summary && (
            <p className="text-sm text-muted-foreground">
              {summary.pricePaidLabel}
              {summary.isRecurring && " / month"}
            </p>
          )}
        </div>

        {summary?.paid === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            We&rsquo;re still confirming your payment with Stripe. Refresh in a
            moment to see the live status.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {summary?.artistUsername && (
            <Link
              href={`/${summary.artistUsername}`}
              className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Back to {summary.artistName}&rsquo;s profile →
            </Link>
          )}
          {summary?.isRecurring && (
            <Link
              href="/dashboard?tab=subscriptions"
              className="text-sm border border-stone-200 rounded-lg px-4 py-2 hover:bg-stone-50 transition-colors"
            >
              Manage your subscriptions →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
