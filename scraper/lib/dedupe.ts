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
    const titleScore = tokenSortRatio(a.titleNorm, b.titleNorm);
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
