export const dynamic = "force-dynamic";
import { getAllProfiles } from "@/lib/admin";
import { getRegions, getCitiesWithRegions } from "@/lib/regions";
import { buildMapPins } from "@/lib/artist-map";
import { computeRegionCoverage, computeCatalogStatus } from "@/lib/region-coverage";
import { AdminArtistsView } from "@/components/admin/AdminArtistsView";

export const metadata = { title: "Artists — Admin — Patronage" };

export default async function AdminArtistsPage() {
  const [artists, regions, cities] = await Promise.all([
    getAllProfiles(),
    getRegions(),
    getCitiesWithRegions(),
  ]);

  const { pins, unplaced } = buildMapPins(artists, regions, cities);
  const coverage = computeRegionCoverage(regions, artists);
  const catalog = computeCatalogStatus(coverage, artists);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Artists</h1>
        <p className="text-xs text-muted-foreground">
          {artists.length} total · Set country to place an artist in the public
          directory (NZ/AUS) or under International · Toggle active status or
          Patronage Supported badge · Delete permanently removes the profile and
          portfolio.
        </p>
      </div>
      <AdminArtistsView
        artists={artists}
        cities={cities}
        pins={pins}
        unplacedArtists={unplaced.artists}
        coverage={coverage}
        catalog={catalog}
      />
    </div>
  );
}
