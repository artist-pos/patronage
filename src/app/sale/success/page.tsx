import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/commerce-fee";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment received — Patronage",
};

interface Props {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function SaleSuccessPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sessionId = sp.session_id ?? null;

  let summary: {
    workTitle: string;
    artistName: string;
    paid: boolean;
    pricePaidLabel: string;
    ledgerId: string | null;
    claimUrl: string | null;
  } | null = null;

  if (sessionId) {
    const admin = createAdminClient();
    const { data: sale } = await admin
      .from("primary_sale_transactions")
      .select("artwork_id, artist_id, status, buyer_paid_total_cents, currency, buyer_email")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (sale) {
      const [{ data: artwork }, { data: artist }, { data: link }] = await Promise.all([
        admin
          .from("artworks")
          .select("title, ledger_id")
          .eq("id", sale.artwork_id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("full_name, username")
          .eq("id", sale.artist_id)
          .maybeSingle(),
        admin
          .from("provenance_links")
          .select("claim_token")
          .eq("artwork_id", sale.artwork_id)
          .eq("patron_email", sale.buyer_email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      summary = {
        workTitle: artwork?.title ?? "Untitled",
        artistName: artist?.full_name ?? artist?.username ?? "the artist",
        paid: sale.status === "paid",
        pricePaidLabel: formatCents(sale.buyer_paid_total_cents, sale.currency),
        ledgerId: artwork?.ledger_id ?? null,
        claimUrl: link?.claim_token ? `/claim/${link.claim_token}` : null,
      };
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-16">
      <div className="max-w-xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-emerald-700">Payment received</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {summary ? `Thanks — ${summary.workTitle} is yours` : "Thanks for your payment"}
          </h1>
          {summary && (
            <p className="text-sm text-muted-foreground">
              by {summary.artistName} · {summary.pricePaidLabel}
            </p>
          )}
        </div>

        {summary?.paid === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            We&rsquo;re still confirming your payment with Stripe. Refresh in a
            moment to see your provenance details.
          </div>
        )}

        {summary?.paid && (
          <div className="space-y-3">
            <p className="text-sm">
              The ownership ledger has been updated. Your provenance certificate
              is on its way.
            </p>
            <div className="flex flex-wrap gap-3">
              {summary.ledgerId && (
                <Link
                  href={`/provenance/${summary.ledgerId}`}
                  className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  View provenance →
                </Link>
              )}
              {summary.claimUrl && (
                <Link
                  href={summary.claimUrl}
                  className="text-sm border border-stone-200 rounded-lg px-4 py-2 hover:bg-stone-50 transition-colors"
                >
                  Claim your Patronage account →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
