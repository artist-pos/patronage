/**
 * Registry of third-party boards we attribute listings to.
 *
 * `opportunities.source` stores the key only (migration 179); every user-facing
 * detail — the label, the link back — is resolved from here, so adding a source
 * or renaming one is a single-file change with no data migration. A listing we
 * found ourselves, or one a partner submitted directly, leaves `source` null.
 */

export interface OpportunitySource {
  /** Stored in opportunities.source. Stable — changing it means a data migration. */
  key: string;
  /** Shown to readers, e.g. "Source: The Big Idea". */
  label: string;
  /** Fallback link-back when a listing has no source_url of its own. */
  url: string;
  /** Hostnames that identify a listing as theirs. Subdomains match too. */
  domains: string[];
}

export const OPPORTUNITY_SOURCES: OpportunitySource[] = [
  {
    key: "the_big_idea",
    label: "The Big Idea",
    url: "https://www.thebigidea.nz",
    // TBI serves the same listings on both TLDs — .co.nz is the canonical
    // domain for their sitemaps, .nz is what the public site links to.
    domains: ["thebigidea.nz", "thebigidea.co.nz"],
  },
];

const BY_KEY = new Map(OPPORTUNITY_SOURCES.map((s) => [s.key, s]));

/** The registry entry for a stored key, or null if the key is unknown/absent. */
export function getOpportunitySource(
  key: string | null | undefined
): OpportunitySource | null {
  return key ? BY_KEY.get(key) ?? null : null;
}

function hostOf(raw: string): string | null {
  const trimmed = raw.trim();
  // Bare "thebigidea.nz/opportunities/…" pastes have no protocol for URL() to parse.
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Source key for a listing URL, or null when the domain isn't one we attribute. */
export function sourceKeyForUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const host = hostOf(raw);
  if (!host) return null;
  const match = OPPORTUNITY_SOURCES.find((s) =>
    s.domains.some((d) => host === d || host.endsWith(`.${d}`))
  );
  return match?.key ?? null;
}

/**
 * Source key for a blob of pasted page text — matches a source domain appearing
 * anywhere in it (canonical URL, share links, footer). Looser than
 * sourceKeyForUrl by design: pasted text has no single authoritative URL.
 */
export function sourceKeyForText(text: string | null | undefined): string | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  const match = OPPORTUNITY_SOURCES.find((s) =>
    s.domains.some((d) => haystack.includes(d))
  );
  return match?.key ?? null;
}
