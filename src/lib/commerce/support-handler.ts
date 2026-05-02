import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAuthUserIdByEmail } from "@/lib/supabase/find-user-by-email";

/**
 * Webhook handler for purpose=support_one_off OR support_recurring on
 * checkout.session.completed. Marks the row paid/active and stores Stripe
 * customer + subscription ids so future renewal events (invoice.paid,
 * customer.subscription.deleted) can find the row.
 *
 * Idempotent on stripe_session_id.
 */
export async function handleSupportCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const subId = session.metadata?.support_subscription_id;
  if (!subId) {
    console.warn("[support handler] missing support_subscription_id");
    return;
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("support_subscriptions")
    .select("*")
    .eq("id", subId)
    .maybeSingle();
  if (!sub) {
    console.warn(`[support handler] subscription ${subId} not found`);
    return;
  }
  if (sub.status === "active" || sub.status === "one_off_paid") return;

  const startedAt = new Date().toISOString();
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Resolve supporter to a profile (existing or shadow). One-offs and
  // subscriptions both follow the same supporter-shadow pattern as resale.
  const supporterEmail = (session.customer_details?.email ?? sub.supporter_email).toLowerCase();
  let supporterId: string | null = sub.supporter_id;
  if (!supporterId) {
    supporterId = await findAuthUserIdByEmail(admin, supporterEmail);
    if (!supporterId) {
      const { data: created } = await admin.auth.admin.createUser({
        email: supporterEmail,
        email_confirm: false,
      });
      if (created?.user) {
        supporterId = created.user.id;
        await admin.from("profiles").upsert(
          {
            id: supporterId,
            username: `patron-${supporterId.slice(0, 8)}`,
            full_name: session.customer_details?.name ?? null,
            role: "patron",
            account_status: "shadow",
          },
          { onConflict: "id" },
        );
      }
    }
  }

  await admin
    .from("support_subscriptions")
    .update({
      supporter_id: supporterId,
      supporter_email: supporterEmail,
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_payment_intent: paymentIntent,
      status: sub.tier_type === "recurring" ? "active" : "one_off_paid",
      started_at: startedAt,
    })
    .eq("id", sub.id);
}

/**
 * Webhook handler for `invoice.paid`. Fires on every successful renewal of
 * a recurring subscription (and the initial charge, which we no-op since
 * `handleSupportCompleted` already moved the row to active). Refreshes
 * `current_period_end` so dashboards can display the next renewal date.
 *
 * Idempotent: same invoice arriving twice updates the same row identically.
 */
export async function handleSupportInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return; // not a subscription invoice — ignore

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("support_subscriptions")
    .select("id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!sub) {
    // Renewal for a subscription we don't recognise — likely test data or
    // a row deleted manually. Log and move on.
    console.warn(`[support handler] invoice.paid for unknown subscription ${subscriptionId}`);
    return;
  }

  const periodEnd = invoice.lines?.data[0]?.period?.end;
  const update: Record<string, unknown> = { status: "active" };
  if (typeof periodEnd === "number") {
    update.current_period_end = new Date(periodEnd * 1000).toISOString();
  }

  await admin.from("support_subscriptions").update(update).eq("id", sub.id);
}

/**
 * Webhook handler for `customer.subscription.deleted`. Fires when a supporter
 * cancels via the Billing Portal (immediate or at period end), or when Stripe
 * cancels for repeated payment failure. Marks the row `canceled` and stamps
 * `canceled_at` so the artist's dashboard stops counting them as a supporter.
 */
export async function handleSupportSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("support_subscriptions")
    .select("id, status")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if (!sub) {
    console.warn(`[support handler] subscription.deleted for unknown ${subscription.id}`);
    return;
  }
  if (sub.status === "canceled") return;

  await admin
    .from("support_subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", sub.id);
}

/**
 * Webhook handler for `invoice.payment_failed`. Stripe will retry per the
 * subscription's dunning settings; we just mark the row `past_due` so the
 * supporter and recipient can see the state.
 */
export async function handleSupportInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const admin = createAdminClient();
  await admin
    .from("support_subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);
}

/**
 * Extract a subscription id from an Invoice across Stripe API versions.
 * In 2025+, the top-level `invoice.subscription` was removed; the id now
 * lives on `invoice.parent.subscription_details.subscription` for
 * subscription invoices, and on each line item.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type === "subscription_details" && parent.subscription_details) {
    const sub = parent.subscription_details.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object" && "id" in sub) return (sub as { id: string }).id;
  }
  // Fallback: read from the first line item.
  const lineSub = invoice.lines?.data[0]?.subscription;
  if (typeof lineSub === "string") return lineSub;
  if (lineSub && typeof lineSub === "object" && "id" in lineSub) {
    return (lineSub as { id: string }).id;
  }
  return null;
}
