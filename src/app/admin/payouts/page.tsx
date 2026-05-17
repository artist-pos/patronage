export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { PayoutsList } from "@/components/admin/PayoutsList";
import type {
  PrimarySaleTransaction,
  Profile,
  ResaleTransaction,
  RoyaltyHold,
} from "@/types/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payouts — Patronage admin",
};

export interface SellerPayoutRow {
  /** Discriminator: which *_transactions table this row came from. The
   *  admin's "mark paid" action branches on this. */
  kind: "resale" | "primary_sale";
  transactionId: string;
  workTitle: string;
  seller: Pick<Profile, "id" | "username" | "full_name">;
  amountCents: number;
  /** Total the buyer paid — used in revert refund amount shown to admin. */
  buyerPaidTotalCents: number;
  currency: string;
  paidAt: string | null;
  /** Only populated for primary_sale rows — enables the "Revert sale" button. */
  stripePaymentIntent: string | null;
  artistPayoutStatus: string | null;
}

export interface RoyaltyHoldRow {
  hold: RoyaltyHold;
  workTitle: string;
  artistLabel: string;
  expired: boolean;
}

export default async function PayoutsPage() {
  if (!(await isAdmin())) redirect("/");

  const admin = createAdminClient();

  // Pull pending payouts from both resale + primary sale tables in parallel,
  // then UNION them in app code so the admin queue is a single list.
  const [
    { data: pendingResaleSellers },
    { data: pendingPrimaryArtists },
    { data: heldRoyalties },
  ] = await Promise.all([
    admin
      .from("resale_transactions")
      .select("*")
      .eq("status", "paid")
      .eq("seller_payout_status", "owed")
      .order("paid_at", { ascending: true }),
    admin
      .from("primary_sale_transactions")
      .select("*")
      .eq("status", "paid")
      .eq("artist_payout_status", "owed")
      .eq("payout_method", "manual")
      .order("paid_at", { ascending: true }),
    admin
      .from("royalty_holds")
      .select("*")
      .eq("status", "held")
      .order("expires_at", { ascending: true }),
  ]);

  const resaleRows = (pendingResaleSellers ?? []) as ResaleTransaction[];
  const primaryRows = (pendingPrimaryArtists ?? []) as PrimarySaleTransaction[];

  const sellerIds = [
    ...resaleRows.map((r) => r.seller_id),
    ...primaryRows.map((r) => r.artist_id),
  ];
  const artworkIds = Array.from(
    new Set([
      ...resaleRows.map((r) => r.artwork_id),
      ...primaryRows.map((r) => r.artwork_id),
      ...(heldRoyalties ?? []).map((h) => h.artwork_id),
    ]),
  );
  const artistIds = (heldRoyalties ?? [])
    .map((h) => h.artist_profile_id)
    .filter((id): id is string => !!id);

  const [{ data: sellers }, { data: artworks }, { data: artists }] = await Promise.all([
    sellerIds.length > 0
      ? admin.from("profiles").select("id, username, full_name").in("id", sellerIds)
      : Promise.resolve({ data: [] }),
    artworkIds.length > 0
      ? admin.from("artworks").select("id, title, caption").in("id", artworkIds)
      : Promise.resolve({ data: [] }),
    artistIds.length > 0
      ? admin.from("profiles").select("id, username, full_name").in("id", artistIds)
      : Promise.resolve({ data: [] }),
  ]);

  const sellerById = new Map((sellers ?? []).map((p) => [p.id, p]));
  const artworkLabelById = new Map(
    (artworks ?? []).map((a) => [a.id, a.title ?? a.caption ?? "Untitled"]),
  );
  const artistById = new Map((artists ?? []).map((p) => [p.id, p]));

  const sellerRows: SellerPayoutRow[] = [
    ...resaleRows.map((r): SellerPayoutRow | null => {
      const seller = sellerById.get(r.seller_id);
      if (!seller) return null;
      return {
        kind: "resale",
        transactionId: r.id,
        workTitle: artworkLabelById.get(r.artwork_id) ?? "Untitled",
        seller,
        amountCents: r.sale_price_cents,
        buyerPaidTotalCents: r.sale_price_cents,
        currency: r.currency,
        paidAt: r.paid_at,
        stripePaymentIntent: null,
        artistPayoutStatus: null,
      };
    }),
    ...primaryRows.map((r): SellerPayoutRow | null => {
      const seller = sellerById.get(r.artist_id);
      if (!seller) return null;
      return {
        kind: "primary_sale",
        transactionId: r.id,
        workTitle: artworkLabelById.get(r.artwork_id) ?? "Untitled",
        seller,
        amountCents: r.sale_price_cents,
        buyerPaidTotalCents: r.buyer_paid_total_cents,
        currency: r.currency,
        paidAt: r.paid_at,
        stripePaymentIntent: r.stripe_payment_intent,
        artistPayoutStatus: r.artist_payout_status,
      };
    }),
  ].filter((r): r is SellerPayoutRow => r !== null);

  // Server component — Date.now() is the natural way to compute "is the
  // 90-day expiry past" at request time. The react-hooks/purity rule fires
  // even though we're not in a render-side cache.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const royaltyRows: RoyaltyHoldRow[] = (heldRoyalties ?? []).map((h) => {
    const artist = h.artist_profile_id ? artistById.get(h.artist_profile_id) : null;
    const artistLabel =
      artist?.full_name
      ?? artist?.username
      ?? h.artist_name_text
      ?? "Unknown artist";
    return {
      hold: h as RoyaltyHold,
      workTitle: artworkLabelById.get(h.artwork_id) ?? "Untitled",
      artistLabel,
      expired: new Date(h.expires_at).getTime() < now,
    };
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="mb-8 space-y-2">
        <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground">
          ← Back to admin
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Pending seller payouts and held artist royalties. Money movement
          happens out-of-band (bank transfer / Stripe Payouts dashboard) —
          this view tracks the disbursement once it&rsquo;s done.
        </p>
      </div>

      <PayoutsList sellerPayouts={sellerRows} royaltyHolds={royaltyRows} />
    </div>
  );
}
