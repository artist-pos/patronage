import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
import { formatCents } from "@/lib/commerce-fee";
import { PaymentsSection } from "@/components/studio/PaymentsSection";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Earnings — Studio — Patronage",
};

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role, username, stripe_connect_status, gst_registered, gst_number")
    .eq("id", user.id)
    .single();

  if (!profileRow || (profileRow.role !== "artist" && profileRow.role !== "owner")) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [
    { data: primarySales },
    { data: royaltyHolds },
    { data: supportPayments },
  ] = await Promise.all([
    admin
      .from("primary_sale_transactions")
      .select("id, artwork_id, sale_price_cents, patronage_commission_cents, currency, status, artist_payout_status, paid_at, created_at")
      .eq("artist_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("royalty_holds")
      .select("id, artwork_id, amount_cents, currency, status, paid_at, created_at")
      .eq("artist_profile_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("support_subscriptions")
      .select("id, amount_cents, patronage_commission_cents, currency, tier_type, status, supporter_name, supporter_email, started_at, created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch artwork titles for all referenced artworks in parallel
  const artworkIds = Array.from(new Set([
    ...(primarySales ?? []).map((r) => r.artwork_id),
    ...(royaltyHolds ?? []).map((r) => r.artwork_id),
  ]));

  const { data: artworks } = artworkIds.length > 0
    ? await admin.from("artworks").select("id, title, caption").in("id", artworkIds)
    : { data: [] };

  const artworkLabel = (id: string) => {
    const a = (artworks ?? []).find((w) => w.id === id);
    return a?.title ?? a?.caption ?? "Untitled";
  };

  // Compute summary numbers
  const paidPrimary = (primarySales ?? []).filter((r) => r.status === "paid");
  const paidRoyalties = (royaltyHolds ?? []).filter((r) => r.status === "paid");
  const paidSupport = (supportPayments ?? []).filter(
    (r) => r.status === "one_off_paid" || r.status === "active",
  );

  const primaryEarningsCents = paidPrimary.reduce(
    (sum, r) => sum + (r.sale_price_cents - r.patronage_commission_cents),
    0,
  );
  const royaltyEarningsCents = paidRoyalties.reduce((sum, r) => sum + r.amount_cents, 0);
  const supportEarningsCents = paidSupport.reduce(
    (sum, r) => sum + (r.amount_cents - r.patronage_commission_cents),
    0,
  );
  const totalEarningsCents = primaryEarningsCents + royaltyEarningsCents + supportEarningsCents;

  const pendingPayoutCents = (primarySales ?? [])
    .filter((r) => r.status === "paid" && r.artist_payout_status === "owed")
    .reduce((sum, r) => sum + (r.sale_price_cents - r.patronage_commission_cents), 0);

  const activeSubscriptions = (supportPayments ?? []).filter((r) => r.status === "active");
  const recurringMonthlyNetCents = activeSubscriptions
    .filter((r) => r.tier_type === "recurring")
    .reduce((sum, r) => sum + (r.amount_cents - r.patronage_commission_cents), 0);

  const connectEnabled = profileRow.stripe_connect_status === "enabled";

  return (
    <StudioPageShell username={profileRow.username} activeSection="earnings">
      <div className="space-y-10 max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">Earnings</h2>
            <p className="text-sm text-muted-foreground">
              Sales, support payments, and resale royalties — all paid directly to your bank.
            </p>
          </div>
          <a
            href="/studio/connect"
            className="shrink-0 text-sm px-4 py-2 border border-border hover:bg-muted/40 transition-colors whitespace-nowrap"
          >
            {connectEnabled ? "Manage payouts →" : "Connect bank →"}
          </a>
        </div>

        {!connectEnabled && (
          <div className="border border-stone-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Bank account not connected</p>
              <p className="text-xs text-muted-foreground">
                Commerce is live. Connect your bank once and all payouts — work sales, support, resale royalties — deposit automatically.
              </p>
            </div>
            <a
              href="/studio/connect"
              className="shrink-0 text-sm px-4 py-2 bg-black text-white rounded-lg hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              Connect bank →
            </a>
          </div>
        )}

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <SummaryCard
            label="Total earned (NZD)"
            value={formatCents(totalEarningsCents, "NZD")}
            note="All surfaces, all time"
          />
          <SummaryCard
            label="Pending payout"
            value={pendingPayoutCents > 0 ? formatCents(pendingPayoutCents, "NZD") : "—"}
            note="Awaiting transfer"
            highlight={pendingPayoutCents > 0}
          />
          {recurringMonthlyNetCents > 0 && (
            <SummaryCard
              label="Monthly support"
              value={formatCents(recurringMonthlyNetCents, "NZD")}
              note={`${activeSubscriptions.filter((r) => r.tier_type === "recurring").length} active subscriber${activeSubscriptions.filter((r) => r.tier_type === "recurring").length !== 1 ? "s" : ""}`}
            />
          )}
        </div>

        {/* Primary sales */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Sales
          </h3>
          {(primarySales ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="border border-stone-100 rounded-lg divide-y divide-stone-100 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-stone-400 bg-stone-50">
                <span>Work</span>
                <span className="text-right">Sale price</span>
                <span className="text-right">Your take (90%)</span>
                <span className="text-right">Payout</span>
              </div>
              {(primarySales ?? []).map((r) => {
                const artistNetCents = r.sale_price_cents - r.patronage_commission_cents;
                const payoutLabel =
                  r.status === "reverted"
                    ? "Reverted"
                    : r.artist_payout_status === "paid"
                    ? "Paid"
                    : r.status === "paid"
                    ? "Pending"
                    : "—";
                const payoutClass =
                  r.status === "reverted"
                    ? "text-stone-400"
                    : r.artist_payout_status === "paid"
                    ? "text-emerald-600"
                    : r.status === "paid"
                    ? "text-amber-600"
                    : "text-stone-400";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1 sm:gap-4 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{artworkLabel(r.artwork_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.paid_at?.slice(0, 10) ?? r.created_at.slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {formatCents(r.sale_price_cents, r.currency)}
                    </div>
                    <div className="text-right text-sm font-medium">
                      {r.status === "reverted" ? "—" : formatCents(artistNetCents, r.currency)}
                    </div>
                    <div className={`text-right text-xs font-medium ${payoutClass}`}>
                      {payoutLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Resale royalties */}
        {(royaltyHolds ?? []).length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
              Resale Royalties
            </h3>
            <div className="border border-stone-100 rounded-lg divide-y divide-stone-100 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-stone-400 bg-stone-50">
                <span>Work</span>
                <span className="text-right">Royalty (5%)</span>
                <span className="text-right">Status</span>
              </div>
              {(royaltyHolds ?? []).map((r) => {
                const statusLabel =
                  r.status === "paid" ? "Paid" :
                  r.status === "refunded_to_seller" ? "Expired" :
                  "Held";
                const statusClass =
                  r.status === "paid" ? "text-emerald-600" :
                  r.status === "refunded_to_seller" ? "text-stone-400" :
                  "text-amber-600";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-1 sm:gap-4 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{artworkLabel(r.artwork_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        Resale · {r.created_at.slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-right font-medium">
                      {formatCents(r.amount_cents, r.currency)}
                    </div>
                    <div className={`text-right text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* GST / Payment profile */}
        <section className="space-y-3 border-t border-stone-100 pt-8">
          <PaymentsSection
            profileId={user.id}
            initialGstRegistered={(profileRow as { gst_registered?: boolean } | null)?.gst_registered ?? false}
            initialGstNumber={(profileRow as { gst_number?: string | null } | null)?.gst_number ?? null}
          />
        </section>

        {/* Support */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-500">
            Support
          </h3>
          {(supportPayments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No support payments yet.</p>
          ) : (
            <div className="border border-stone-100 rounded-lg divide-y divide-stone-100 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 text-[10px] uppercase tracking-widest text-stone-400 bg-stone-50">
                <span>Supporter</span>
                <span className="text-right">Type</span>
                <span className="text-right">Net (95%)</span>
                <span className="text-right">Status</span>
              </div>
              {(supportPayments ?? []).map((r) => {
                const net = r.amount_cents - r.patronage_commission_cents;
                const statusLabel =
                  r.status === "active" ? "Active" :
                  r.status === "one_off_paid" ? "Paid" :
                  r.status === "canceled" ? "Cancelled" :
                  r.status;
                const statusClass =
                  r.status === "active" || r.status === "one_off_paid" ? "text-emerald-600" :
                  r.status === "canceled" ? "text-stone-400" :
                  "text-muted-foreground";
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1 sm:gap-4 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {r.supporter_name ?? r.supporter_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.started_at?.slice(0, 10) ?? r.created_at.slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground capitalize">
                      {r.tier_type === "one_off" ? "One-off" : "Monthly"}
                    </div>
                    <div className="text-right font-medium">
                      {formatCents(net, r.currency)}
                    </div>
                    <div className={`text-right text-xs font-medium ${statusClass}`}>
                      {statusLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </StudioPageShell>
  );
}

function SummaryCard({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded-lg p-4 space-y-1 ${highlight ? "border-amber-300 bg-amber-50/40" : "border-stone-100"}`}>
      <p className="text-[10px] uppercase tracking-widest text-stone-400">{label}</p>
      <p className={`text-xl font-semibold ${highlight ? "text-amber-700" : ""}`}>{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
