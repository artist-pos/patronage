import { REGIONAL_ARTS_ORGS } from "@/lib/regional-arts-orgs";
import type { LocalBoard, Profile, Region } from "@/types/database";

export interface RegionCoverage {
  regionId: string;
  slug: string;
  name: string;
  island: Region["island"];
  /** Active artists placed in this region. */
  artistCount: number;
  /** The regional arts organisation anchoring the region, if one exists. */
  org: { id: string; username: string; name: string; shadow: boolean } | null;
}

type CoverageProfile = Pick<
  Profile,
  "id" | "username" | "full_name" | "role" | "is_active" | "region_id" | "org_category" | "account_status" | "local_board_id"
>;

/**
 * Artists per region and who anchors each. An artist is "attached" to a
 * regional arts organisation by where they work (region_id), not by anyone
 * listing them, so this is what a shadow org's claim page can promise.
 */
export function computeRegionCoverage(
  regions: Array<Pick<Region, "id" | "slug" | "name" | "island" | "sort_order">>,
  profiles: CoverageProfile[]
): RegionCoverage[] {
  const counts = new Map<string, number>();
  const orgs = new Map<string, RegionCoverage["org"]>();

  for (const p of profiles) {
    if (!p.region_id) continue;
    if (p.is_active && (p.role === "artist" || p.role === "owner")) {
      counts.set(p.region_id, (counts.get(p.region_id) ?? 0) + 1);
    } else if (p.role === "partner" && p.org_category === "regional_arts_org") {
      const shadow = p.account_status === "shadow";
      const existing = orgs.get(p.region_id);
      // A claimed organisation outranks a shadow one for the same region.
      if (!existing || (existing.shadow && !shadow)) {
        orgs.set(p.region_id, {
          id: p.id,
          username: p.username,
          name: p.full_name ?? p.username,
          shadow,
        });
      }
    }
  }

  return [...regions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      regionId: r.id,
      slug: r.slug,
      name: r.name,
      island: r.island,
      artistCount: counts.get(r.id) ?? 0,
      org: orgs.get(r.id) ?? null,
    }));
}

export interface CatalogOrgStatus {
  key: string;
  name: string;
  bio: string;
  /** Region the organisation is created in. Null only if the taxonomy lacks it. */
  regionId: string | null;
  regionSlug: string;
  regionNames: string[];
  /** Active artists across every region it covers. */
  artistCount: number;
  /** Artists per local board for the home region, non-empty boards only, with
   *  anyone in the region who has not named one counted as "Not set". */
  boards: Array<{
    boardId: string | null;
    name: string;
    count: number;
    /** The local_board_arts_org broker for this board, if one has a profile. */
    org: { id: string; username: string; name: string; shadow: boolean } | null;
  }>;
  profile: { id: string; username: string; name: string; shadow: boolean } | null;
}

// Same folding as locationKey() in regions.ts, kept local so this module stays
// free of server-only imports.
const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * The known regional arts organisations, each with its artist count and
 * whether a profile for it exists. Matched by name first, so a profile the
 * admin renamed slightly still lines up; failing that, by being the regional
 * arts org already anchoring the region it would be created in.
 */
export function computeCatalogStatus(
  coverage: RegionCoverage[],
  profiles: CoverageProfile[],
  boards: Array<Pick<LocalBoard, "id" | "region_id" | "name">> = []
): CatalogOrgStatus[] {
  const bySlug = new Map(coverage.map((c) => [c.slug, c]));
  const partners = profiles.filter((p) => p.role === "partner");

  return REGIONAL_ARTS_ORGS.map((def) => {
    const home = bySlug.get(def.regionSlug) ?? null;
    const covered = def.coversSlugs
      .map((s) => bySlug.get(s))
      .filter((c): c is RegionCoverage => !!c);

    const match =
      partners.find((p) => norm(p.full_name) === norm(def.name)) ??
      partners.find(
        (p) =>
          p.org_category === "regional_arts_org" && !!home && p.region_id === home.regionId
      ) ??
      null;

    const homeBoards = boards.filter((b) => b.region_id === home?.regionId);
    const boardCounts = new Map<string, number>();
    const boardOrgs = new Map<string, CatalogOrgStatus["boards"][number]["org"]>();
    let noBoard = 0;
    if (home && homeBoards.length > 0) {
      for (const p of profiles) {
        if (p.region_id !== home.regionId) continue;
        if (p.role === "partner" && p.org_category === "local_board_arts_org" && p.local_board_id) {
          const shadow = p.account_status === "shadow";
          const existing = boardOrgs.get(p.local_board_id);
          // A claimed broker outranks a shadow one for the same board.
          if (!existing || (existing.shadow && !shadow)) {
            boardOrgs.set(p.local_board_id, {
              id: p.id,
              username: p.username,
              name: p.full_name ?? p.username,
              shadow,
            });
          }
          continue;
        }
        if (!p.is_active || (p.role !== "artist" && p.role !== "owner")) continue;
        if (p.local_board_id && homeBoards.some((b) => b.id === p.local_board_id)) {
          boardCounts.set(p.local_board_id, (boardCounts.get(p.local_board_id) ?? 0) + 1);
        } else {
          noBoard++;
        }
      }
    }
    // Every board in the region is shown, not just ones with artists already —
    // a broker can be set up ahead of anyone naming that board.
    const boardRows: CatalogOrgStatus["boards"] = homeBoards
      .map((b) => ({
        boardId: b.id,
        name: b.name,
        count: boardCounts.get(b.id) ?? 0,
        org: boardOrgs.get(b.id) ?? null,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    if (boardRows.length > 0 && noBoard > 0) {
      boardRows.push({ boardId: null, name: "Not set", count: noBoard, org: null });
    }

    return {
      key: def.key,
      name: def.name,
      bio: def.bio,
      regionId: home?.regionId ?? null,
      regionSlug: def.regionSlug,
      regionNames: covered.map((c) => c.name),
      artistCount: covered.reduce((n, c) => n + c.artistCount, 0),
      boards: boardRows,
      profile: match
        ? {
            id: match.id,
            username: match.username,
            name: match.full_name ?? match.username,
            shadow: match.account_status === "shadow",
          }
        : null,
    };
  });
}
