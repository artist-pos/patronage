# Commerce fee policy (v1)

This is the canonical reference for how money moves through Patronage. Code
that talks to Stripe should always derive amounts via `lib/commerce-fee.ts`,
never hard-code percentages.

## Fee structure (resales)

```
Seller lists at: $S        (the "sticker price")
Buyer pays:      $S × 1.15
Patronage keeps: $S × 0.10  (commission)
Artist royalty:  $S × 0.05  (held until paid out / refunded)
Seller receives: $S         (full sticker)
```

This model is buyer-pays-from-sticker: the listed price is what the seller
nets, the buyer pays 15% on top. We chose this over seller-pays-from-proceeds
because it makes listing prices comparable across the market — the sticker
is what a seller receives, full stop.

The 5% artist royalty is **non-optional** and applies to every resale on
Patronage, not just sales over the NZ$2,000 statutory threshold. The line
"a 5% royalty is collected on every resale" is platform policy, not fine
print.

## Fee structure (artist support / patronage tiers)

```
Patron pays:     $P + Stripe fee  (buyer pays gross-up)
Patronage keeps: $P × 0.05       (5% commission)
Artist receives: $P × 0.95
```

Support tiers (one-off and recurring) carry a 5% commission — lower than
the resale rate to encourage artists to monetise their practice directly.

## Royalty routing

The 5% is collected at sale time and earmarked in `royalty_holds`. From
there:

| Artist state                                  | Action |
|-----------------------------------------------|--------|
| On Patronage, payout details on file          | Manual payout from Patronage's Stripe balance; mark `paid_at`. |
| On Patronage, no payout details               | Hold; email asking them to add payout details. |
| Not on Patronage (stub)                       | Hold; outreach via the unified token panel. |
| Unreachable for >90 days (`expires_at` past)  | Refund to the seller; flag artwork "royalty unpaid". |

Refund-to-seller after 90 days keeps Patronage out of escrow / deposit-taking
regulation. We're not holding funds indefinitely on behalf of someone we
can't reach.

## Refunds, chargebacks, reverts

Every reversal appends a `reverted` entry to `artwork_provenance_ledger` —
we never delete a row. The chain stays append-only and the public provenance
page can render the reversal alongside the original transfer.

## GST

Patronage's commerce volume is below the NZ$60k registration threshold for
v1. The schema stores all figures in cents and the policy line item exists
("commission is GST-exclusive") so we can flip on GST collection without a
schema migration when revenue justifies. Commission and royalty figures
shown to users will need a "+ GST" suffix once registered.

## Currency

NZD only for v1. The `currency` column on `resale_transactions` and
`royalty_holds` exists for forward-compatibility but is currently always
`'NZD'`.

## What changes if/when RRA reporting is wired in

Phase 7 deliberately ships without RRA integration. When that flips on:

- The 5% routing target switches from "the artist" to "RRA" for sales
  >= NZ$2,000.
- Sub-threshold (< NZ$2,000) routing depends on RRA's confirmed handling.
- AMP reporting obligations get their own admin surface.

Until then, the platform routes the 5% directly to the artist.
