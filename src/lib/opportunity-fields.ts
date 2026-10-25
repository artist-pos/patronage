/**
 * The one definition of what an opportunity form collects and how it is stored.
 *
 * Every surface that creates or edits a listing (the shared OpportunityForm in
 * its create and admin modes, the partner wizard, the Scraper Queue editor, the
 * admin modal, the partner edit form) takes the same fields and writes them through
 * normaliseOpportunityWrite(), so a field behaves the same wherever it is entered.
 *
 * Intentionally narrower elsewhere:
 *  - Community tips ask for a name and a link only; an admin completes the rest.
 *  - Admin-only: is_featured, the recurring schedule, organiser linking, and the
 *    claim outreach details. Partners and the public cannot set them.
 */
import { getOpportunitySource } from "@/lib/opportunity-sources";

/** Longest card caption anyone can type, in every form. */
export const CAPTION_MAX = 300;

export const CURRENCIES = ["NZD", "AUD", "USD", "EUR", "GBP", "CAD"] as const;

export const ARTIST_PAYMENT_OPTIONS = ["Honorarium", "Commission", "Stipend"] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ApplicationLinkLike {
  label?: string | null;
  url?: string | null;
}

/** Lower-cased address, or null when blank or not an email. */
export function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return EMAIL_RE.test(v) && v.length <= 200 ? v : null;
}

/**
 * Fields every write path shares, applied to whatever subset the caller sends:
 *  - blank application-link rows dropped, and `url` kept equal to the first link
 *    (cards, SEO and structured data read `url`; the page prefers the links)
 *  - `source` limited to boards in the registry
 *  - `contact_email` lower-cased, or cleared if it isn't an address
 *  - a foreign-currency entry fee converted to NZD, with the original kept
 */
export async function normaliseOpportunityWrite<T extends Record<string, unknown>>(data: T): Promise<T> {
  const out: Record<string, unknown> = { ...data };

  if (Array.isArray(out.application_links)) {
    const links = (out.application_links as ApplicationLinkLike[]).filter(
      (l) => l && (l.url?.trim() || l.label?.trim())
    );
    out.application_links = links;
    if (!("url" in out)) out.url = links.find((l) => l.url?.trim())?.url?.trim() || null;
  }

  if ("source" in out) {
    const key = out.source as string | null | undefined;
    out.source = key && getOpportunitySource(key) ? key : null;
  }

  if ("contact_email" in out) out.contact_email = cleanEmail(out.contact_email);
  if ("claim_email" in out) out.claim_email = cleanEmail(out.claim_email);

  if ("entry_fee" in out || "entry_fee_currency" in out) {
    const currency = String(out.entry_fee_currency ?? "NZD").toUpperCase();
    const amount = out.entry_fee as number | null | undefined;
    if (amount != null && currency !== "NZD") {
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=NZD`);
        const body = (await res.json()) as { rates?: { NZD?: number } };
        const rate = body.rates?.NZD ?? 1;
        out.entry_fee_local = amount;
        out.entry_fee = Math.round(amount * rate * 100) / 100;
        out.entry_fee_currency = currency;
      } catch {
        // Keep the amount as typed rather than losing it.
        out.entry_fee_local = amount;
        out.entry_fee_currency = currency;
      }
    } else if (currency === "NZD") {
      out.entry_fee_local = null;
      out.entry_fee_currency = null;
    }
  }

  return out as T;
}
