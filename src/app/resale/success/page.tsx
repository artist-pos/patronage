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

export default async function ResaleSuccessPage({ searchParams }: Props) {
  const sp = await searchParams;
  const sessionId = sp.session_id ?? null;

  // Look up the resale row by Stripe session id. Webhook may take a moment
  // to process — surface a polite "still confirming" state if it isn't paid
  // yet rather than 500.
  let resaleSummary: {
    artworkId: string;
    sellerId: string;
    workTitle: string;
    artistName: string;
    paid: boolean;
    pricePaidLabel: string;
    ledgerId: string | null;
    claimUrl: string | null;
  } | null = null;

  if (sessionId) {
    const admin = createAdminClient();
    const { data: resale } = await admin
      .from("resale_transactions")
      .select("artwork_id, seller_id, status, buyer_paid_total_cents, currency, buyer_email")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (resale) {
      const [{ data: artwork }, { data: linkRow }] = await Promise.all([
        admin
          .from("artworks")
          .select("title, ledger_id, attributed_artist_text, attributed_artist_id")
          .eq("id", resale.artwork_id)
          .maybeSingle(),
        admin
          .from("provenance_links")
          .select("claim_token")
          .eq("artwork_id", resale.artwork_id)
          .eq("patron_email", resale.buyer_email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let artistName = artwork?.attributed_artist_text ?? "the artist";
      if (artwork?.attributed_artist_id) {
        const { data: artistProfile } = await admin
          .from("profiles")
          .select("full_name, username")
          .eq("id", artwork.attributed_artist_id)
          .maybeSingle();
        if (artistProfile) {
          artistName = artistProfile.full_name ?? artistProfile.username ?? artistName;
        }
      }

      resaleSummary = {
        artworkId: resale.artwork_id,
        sellerId: resale.seller_id,
        workTitle: artwork?.title ?? "Untitled",
        artistName,
        paid: resale.status === "paid",
        pricePaidLabel: formatCents(resale.buyer_paid_total_cents, resale.currency),
        ledgerId: artwork?.ledger_id ?? null,
        claimUrl: linkRow?.claim_token ? `/claim/${linkRow.claim_token}` : null,
      };
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-16">
      <div className="max-w-xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-emerald-700">Payment received</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {resaleSummary
              ? `Thanks — ${resaleSummary.workTitle} is yours`
              : "Thanks for your payment"}
          </h1>
          {resaleSummary && (
            <p className="text-sm text-muted-foreground">
              by {resaleSummary.artistName} · {resaleSummary.pricePaidLabel}
            </p>
          )}
        </div>

        {resaleSummary?.paid === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            We&rsquo;re still confirming your payment with Stripe. Refresh in a
            moment to see your provenance details.
          </div>
        )}

        {resaleSummary?.paid && (
          <div className="space-y-3">
            <p className="text-sm">
              Your provenance certificate has been emailed to you. The
              ownership ledger has been updated.
            </p>
            <div className="flex flex-wrap gap-3">
              {resaleSummary.ledgerId && (
                <Link
                  href={`/provenance/${resaleSummary.ledgerId}`}
                  className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  View provenance →
                </Link>
              )}
              {resaleSummary.claimUrl && (
                <Link
                  href={resaleSummary.claimUrl}
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
