/**
 * Cross-source duplicate detection.
 *
 * The same open call is cross-posted on 3–4 aggregators with slightly
 * different titles ("Open Call: Summer Salon 2026" vs "Summer Salon 2026 —
 * Call for Entries"). Exact URL/title dedup misses these. This module builds
 * a normalised match key and a fuzzy comparator (token_sort_ratio, the same
 * semantics as rapidfuzz's) applied within a deadline window.
 *
 * Canonical-record priority when records collapse: lowest authority number
 * wins — 1 = original organisation page, 2 = primary aggregator,
 * 3 = secondary aggregator (see Source.authority).
 */
import type { Source } from "../types.js";

export const DEDUPE_TITLE_THRESHOLD = parseInt(process.env.DEDUPE_TITLE_THRESHOLD ?? "90", 10);
export const DEDUPE_ORGANISER_THRESHOLD = parseInt(process.env.DEDUPE_ORGANISER_THRESHOLD ?? "80", 10);
export const DEDUPE_DEADLINE_WINDOW_DAYS = parseInt(process.env.DEDUPE_DEADLINE_WINDOW_DAYS ?? "3", 10);

// ── Normalisation ────────────────────────────────────────────────────────────

/** lowercase, strip years/punctuation, collapse whitespace. */
export function normTitle(title: string): string {
    return title
        .toLowerCase()
        .replace(/\b(19|20)\d{2}\b/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function normOrganiser(organiser: string): string {
    return organiser
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Deterministic match key: normalised title + deadline + normalised organiser.
 * Two records with the same key are always duplicates. Fuzzy matching handles
 * near-misses on top of this.
 */
export function makeMatchKey(title: string, deadline: string | null, organiser: string): string {
    return `${normTitle(title)}||${deadline ?? ""}||${normOrganiser(organiser)}`;
}

// ── token_sort_ratio ─────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    const cur = new Array<number>(b.length + 1);
    for (let i = 1; i <= a.length; i++) {
        cur[0] = i;
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        prev = cur.slice();
    }
    return prev[b.length];
}

function ratio(a: string, b: string): number {
    if (!a.length && !b.length) return 100;
    const dist = levenshtein(a, b);
    return Math.round((1 - dist / Math.max(a.length, b.length)) * 100);
}

/**
 * rapidfuzz-style token_sort_ratio on already-normalised strings:
 * sort tokens alphabetically, join, then Levenshtein similarity 0–100.
 */
export function tokenSortRatio(a: string, b: string): number {
    const sa = a.split(" ").filter(Boolean).sort().join(" ");
    const sb = b.split(" ").filter(Boolean).sort().join(" ");
    return ratio(sa, sb);
}

/**
 * rapidfuzz-style token_set_ratio: tolerant of one title being a subset of
 * the other ("TaDA Residency 2027" vs "TaDA Residency 2027 – Textile Art
 * Residency Switzerland" → 100). To avoid generic short titles ("open call")
 * matching everything, callers should gate on a minimum shared-token count —
 * see isLikelyDuplicate.
 */
export function tokenSetRatio(a: string, b: string): number {
    const ta = new Set(a.split(" ").filter(Boolean));
    const tb = new Set(b.split(" ").filter(Boolean));
    const common = [...ta].filter((t) => tb.has(t)).sort();
    const onlyA = [...ta].filter((t) => !tb.has(t)).sort();
    const onlyB = [...tb].filter((t) => !ta.has(t)).sort();
    const t0 = common.join(" ");
    const t1 = [t0, ...onlyA].filter(Boolean).join(" ");
    const t2 = [t0, ...onlyB].filter(Boolean).join(" ");
    return Math.max(ratio(t0, t1), ratio(t0, t2), ratio(t1, t2));
}

/** Number of tokens the two normalised strings share. */
export function sharedTokenCount(a: string, b: string): number {
    const tb = new Set(b.split(" ").filter(Boolean));
    return a.split(" ").filter(Boolean).filter((t) => tb.has(t)).length;
}

// Art-world boilerplate that says nothing about WHICH opportunity this is.
const GENERIC_TOKENS = new Set([
    "open", "call", "calls", "for", "the", "of", "and", "a", "an", "to", "in",
    "art", "arts", "artist", "artists", "artwork", "works",
    "exhibition", "show", "prize", "award", "awards", "grant", "grants",
    "residency", "residencies", "fellowship", "opportunity", "opportunities",
    "entries", "entry", "submission", "submissions", "competition", "annual",
    "international", "juried", "gallery", "festival", "new",
]);

/** True when the shared vocabulary includes something identity-bearing. */
export function hasDistinctiveSharedToken(a: string, b: string): boolean {
    const tb = new Set(b.split(" ").filter(Boolean));
    return a.split(" ").filter(Boolean).some((t) => tb.has(t) && !GENERIC_TOKENS.has(t));
}

// ── Duplicate decision ───────────────────────────────────────────────────────

export interface DedupeCandidate {
    titleNorm: string;
    organiserNorm: string;
    deadline: string | null; // YYYY-MM-DD
}

/** True when the two deadlines could plausibly be the same opportunity. */
export function deadlinesCompatible(a: string | null, b: string | null, windowDays = DEDUPE_DEADLINE_WINDOW_DAYS): boolean {
    if (!a || !b) return true; // aggregators frequently omit the deadline
    const ta = Date.parse(a), tb = Date.parse(b);
    if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
    return Math.abs(ta - tb) <= windowDays * 86_400_000;
}

/**
 * Fuzzy duplicate test between two records. Requires:
 *  - deadlines within the window (or missing), AND
 *  - title token_sort_ratio ≥ threshold, AND
 *  - organiser agreement (ratio ≥ organiser threshold, one side empty,
 *    or a near-exact title ≥ 95 that overrides organiser noise)
 */
export function isLikelyDuplicate(a: DedupeCandidate, b: DedupeCandidate): boolean {
    if (!deadlinesCompatible(a.deadline, b.deadline)) return false;
    // token_set_ratio catches subset-style cross-posts, but only counts when
    // the shared vocabulary carries identity (≥2 shared tokens, at least one
    // non-generic) — otherwise "open call" would match every open call.
    let titleScore = tokenSortRatio(a.titleNorm, b.titleNorm);
    if (sharedTokenCount(a.titleNorm, b.titleNorm) >= 2 && hasDistinctiveSharedToken(a.titleNorm, b.titleNorm)) {
        titleScore = Math.max(titleScore, tokenSetRatio(a.titleNorm, b.titleNorm));
    }
    if (titleScore < DEDUPE_TITLE_THRESHOLD) return false;
    if (!a.organiserNorm || !b.organiserNorm) return true;
    if (tokenSortRatio(a.organiserNorm, b.organiserNorm) >= DEDUPE_ORGANISER_THRESHOLD) return true;
    return titleScore >= 95;
}

// ── Source authority ─────────────────────────────────────────────────────────

/** Lower = more authoritative. 1 org page, 2 primary aggregator, 3 secondary. */
export function authorityRank(source: Pick<Source, "authority" | "isAggregator">): number {
    return source.authority ?? (source.isAggregator ? 2 : 1);
}

/** Authority of a stored row given its source_url, resolved against the registry. */
export function authorityForSourceUrl(sourceUrl: string | null, sources: Source[]): number {
    if (!sourceUrl) return 2;
    const match = sources.find((s) => s.url === sourceUrl);
    return match ? authorityRank(match) : 2;
}
