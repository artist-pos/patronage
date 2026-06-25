import type { Opportunity } from '@/types/database'
import type { SharePayload } from '@/types/share'

/** Compact dollar formatting — mirrors formatFunding in OpportunityCard. */
function formatDollar(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(0)}M+`
  if (amount >= 100_000) return `$${Math.round(amount / 1_000)}k+`
  if (amount >= 10_000) return `$${Math.round(amount / 1_000)}k`
  return `$${amount.toLocaleString('en-NZ')}`
}

/**
 * Extracts a single prominent dollar figure from a funding range string, used
 * as the Variant C focal value. Returns null for true spans (e.g.
 * "$25,000 – $50,000") so those fall back to the typographic variant.
 */
function parseSingleDollar(range: string | null): string | null {
  if (!range) return null
  const matches = range.match(/\$\s?\d[\d,.]*\s?[kKmM]?/g)
  if (!matches || matches.length !== 1) return null
  return matches[0].replace(/\s+/g, '').replace(/K\b/, 'k').replace(/M\b/, 'M')
}

function formatDeadline(deadline: string | null): string | null {
  if (!deadline) return null
  return new Date(deadline + 'T00:00:00').toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatLocation(opp: Opportunity): string | null {
  const raw = opp.city ? `${opp.city}, ${opp.country}` : opp.country
  if (!raw) return null
  return raw === 'Global' ? 'Open to all' : raw
}

function formatEntryFee(opp: Opportunity): string | null {
  if (opp.entry_fee === null || opp.entry_fee === undefined) return null
  if (opp.entry_fee === 0) return 'Free'
  if (opp.entry_fee_currency && opp.entry_fee_local != null) {
    return `${opp.entry_fee_currency} ${opp.entry_fee_local}`
  }
  return `NZD ${opp.entry_fee}`
}

/**
 * Builds a share payload for an opportunity. The canvas picks one of three
 * layout variants from this data (image-accent / commission-focal / typographic).
 */
export function buildOpportunitySharePayload(opp: Opportunity, shareUrl: string): SharePayload {
  // Disciplines: "Multidisciplinary" subsumes every other medium when present.
  let disciplines = opp.sub_categories ?? []
  if (disciplines.some((d) => d.trim().toLowerCase() === 'multidisciplinary')) {
    disciplines = ['Multidisciplinary']
  }

  // Tag row: type + country + disciplines, trimmed to keep the pill row tidy.
  const tags = [
    opp.type,
    opp.country,
    ...disciplines,
  ].filter((t): t is string => !!t && t.trim().length > 0)
    .slice(0, 5)

  const commission =
    opp.funding_range?.trim() ||
    (opp.funding_amount != null ? formatDollar(opp.funding_amount) : null)

  // Explicit single dollar value drives Variant C; a multi-value span does not.
  const commissionAmount =
    opp.funding_amount != null ? formatDollar(opp.funding_amount) : parseSingleDollar(opp.funding_range)

  return {
    type: 'opportunity',
    title: opp.title,
    sub: opp.organiser,
    price: null,
    tag: opp.type,
    handle: '@patronage',
    imageUrl: opp.featured_image_url,
    shareUrl,
    opportunity: {
      organisation: opp.organiser,
      tags,
      isFree: opp.entry_fee === 0,
      commission,
      commissionAmount,
      deadline: formatDeadline(opp.deadline),
      location: formatLocation(opp),
      entryFee: formatEntryFee(opp),
      routingType: opp.routing_type,
    },
  }
}
