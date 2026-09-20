import type { City, Profile, Region } from "@/types/database";
import { CITY_COORDS, REGION_CENTROIDS } from "@/lib/nz-geo";

export interface MapPerson {
  username: string;
  name: string;
  shadow: boolean;
}

export interface MapPin {
  key: string;
  lat: number;
  lng: number;
  place: string;
  /** True when placed on the region centroid because no town was matched. */
  approx: boolean;
  artists: MapPerson[];
  orgs: MapPerson[];
}

export interface UnplacedCounts {
  /** Active artists with no NZ region or town yet. */
  artists: number;
}

type MapProfile = Pick<
  Profile,
  "username" | "full_name" | "role" | "is_active" | "region_id" | "city_id" | "account_status"
>;

/**
 * One pin per town, grouped, carrying only the fields the popup renders.
 * Falls back to the region centroid when an artist is matched to a region but
 * not a town; anyone with neither is counted as unplaced.
 */
export function buildMapPins(
  profiles: MapProfile[],
  regions: Array<Pick<Region, "id" | "slug" | "name">>,
  cities: Array<Pick<City, "id" | "slug" | "name" | "region_id">>
): { pins: MapPin[]; unplaced: UnplacedCounts } {
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const pins = new Map<string, MapPin>();
  let unplacedArtists = 0;

  for (const p of profiles) {
    const isArtist = p.role === "artist" || p.role === "owner";
    const isOrg = p.role === "partner";
    if (!p.is_active || (!isArtist && !isOrg)) continue;

    let key: string | null = null;
    let coords: [number, number] | undefined;
    let place = "";
    let approx = false;

    const city = p.city_id ? cityById.get(p.city_id) : undefined;
    if (city && CITY_COORDS[city.slug]) {
      key = `city:${city.slug}`;
      coords = CITY_COORDS[city.slug];
      place = city.name;
    } else {
      const regionId = p.region_id ?? city?.region_id ?? null;
      const region = regionId ? regionById.get(regionId) : undefined;
      if (region && REGION_CENTROIDS[region.slug]) {
        key = `region:${region.slug}`;
        coords = REGION_CENTROIDS[region.slug];
        place = region.name;
        approx = true;
      }
    }

    if (!key || !coords) {
      if (isArtist) unplacedArtists++;
      continue;
    }

    let pin = pins.get(key);
    if (!pin) {
      pin = { key, lat: coords[0], lng: coords[1], place, approx, artists: [], orgs: [] };
      pins.set(key, pin);
    }
    const person: MapPerson = {
      username: p.username,
      name: p.full_name ?? p.username,
      shadow: p.account_status === "shadow",
    };
    (isArtist ? pin.artists : pin.orgs).push(person);
  }

  return { pins: [...pins.values()], unplaced: { artists: unplacedArtists } };
}
