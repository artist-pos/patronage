/**
 * Link scraped listings to the organisation's partner account (migration 195)
 * when the organiser name matches one exactly. Followers of that organisation
 * then hear about the listing once it's published (223).
 *
 * Exact matches only, after folding case, macrons and punctuation, and with a
 * trailing "(acronym or te reo name)" also tried on its own removed. Anything
 * looser is left for an admin to link by hand.
 */

/** "Ōrākei Arts" → "orakei arts". Keeps letters that normOrganiser would drop. */
export function foldOrganiser(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * The names a listing's organiser text could match on: the whole thing, and
 * the part before a bracketed alias, e.g. "New Zealand Film Commission (NZFC)".
 * Joint listings ("A / B", "A x B") match nothing, so they stay with an admin.
 */
export function organiserKeys(organiser: string): string[] {
    if (/\s(\/|x|&)\s/i.test(organiser) && !/\(/.test(organiser)) return [];
    const keys = new Set<string>();
    const whole = foldOrganiser(organiser);
    if (whole) keys.add(whole);
    const base = foldOrganiser(organiser.replace(/\s*\([^)]*\)\s*$/, ""));
    if (base) keys.add(base);
    return [...keys];
}

/**
 * Partner name → id. A name two partners share maps to null, so it never
 * links to the wrong one.
 */
export function buildPartnerIndex(partners: Array<{ id: string; full_name: string | null }>): Map<string, string | null> {
    const index = new Map<string, string | null>();
    for (const p of partners) {
        if (!p.full_name) continue;
        const key = foldOrganiser(p.full_name);
        if (!key) continue;
        index.set(key, index.has(key) ? null : p.id);
    }
    return index;
}

export function matchOrganiser(organiser: string, index: Map<string, string | null> | undefined): string | null {
    if (!index || index.size === 0) return null;
    for (const key of organiserKeys(organiser)) {
        const id = index.get(key);
        if (id) return id;
    }
    return null;
}
