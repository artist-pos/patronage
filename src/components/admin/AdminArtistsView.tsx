"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { ArtistTable } from "@/components/admin/ArtistTable";
import { createShadowProfile } from "@/app/admin/claim-tokens/actions";
import type { MapPin } from "@/lib/artist-map";
import type { CatalogOrgStatus, RegionCoverage } from "@/lib/region-coverage";
import { REGIONAL_ARTS_ORGS } from "@/lib/regional-arts-orgs";
import type { CityWithRegion, LocalBoard, Profile } from "@/types/database";

const ArtistMap = dynamic(() => import("@/components/admin/ArtistMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] min-h-[420px] items-center justify-center border border-border text-xs text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface Props {
  artists: Profile[];
  cities: CityWithRegion[];
  boards: LocalBoard[];
  pins: MapPin[];
  unplacedArtists: number;
  coverage: RegionCoverage[];
  catalog: CatalogOrgStatus[];
}

export function AdminArtistsView({ artists, cities, boards, pins, unplacedArtists, coverage, catalog }: Props) {
  const router = useRouter();
  const [focusRegion, setFocusRegion] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Regions no known organisation covers, so they can still be given one by hand.
  const uncovered = useMemo(() => {
    const covered = new Set(REGIONAL_ARTS_ORGS.flatMap((o) => o.coversSlugs));
    return coverage.filter((r) => !covered.has(r.slug));
  }, [coverage]);

  function create(key: string, input: Parameters<typeof createShadowProfile>[0]) {
    setError(null);
    setCreatingKey(key);
    startTransition(async () => {
      const res = await createShadowProfile(input);
      setCreatingKey(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const linkCls = "text-muted-foreground underline underline-offset-2 hover:text-foreground";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          <ArtistMap pins={pins} focusRegion={focusRegion} />
          <p className="text-[11px] text-muted-foreground">
            Black circles are artists (count per town); an amber ring means an organisation is also
            there; faded circles are placed by region only.
            {unplacedArtists > 0 && (
              <>
                {" "}
                {unplacedArtists} active artist{unplacedArtists === 1 ? " has" : "s have"} no NZ
                location yet and are not shown. Set one in the list below.
              </>
            )}
          </p>
        </div>

        <aside className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
              Regional arts organisations
            </p>
            {focusRegion && (
              <button
                type="button"
                onClick={() => setFocusRegion(null)}
                className="text-[11px] text-muted-foreground underline underline-offset-2"
              >
                Reset view
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}

          <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto border border-border">
            {catalog.map((o) => (
              <li key={o.key} className="space-y-1.5 px-3 py-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusRegion(o.regionSlug)}
                    className="text-left font-medium hover:underline underline-offset-2"
                  >
                    {o.name}
                  </button>
                  <span className="shrink-0 text-muted-foreground">
                    {o.artistCount} artist{o.artistCount === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{o.regionNames.join(" · ")}</p>
                {o.boards.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    By local board:{" "}
                    {o.boards.map((b) => `${b.name} ${b.count}`).join(" · ")}
                  </p>
                )}

                {o.profile ? (
                  <p className="text-muted-foreground">
                    <Link href={`/${o.profile.username}`} target="_blank" className="underline underline-offset-2">
                      Profile
                    </Link>{" "}
                    · {o.profile.shadow ? "shadow, unclaimed" : "claimed"}
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={isPending || !o.regionId}
                    onClick={() =>
                      create(o.key, {
                        name: o.name,
                        entityType: "partner",
                        orgCategory: "regional_arts_org",
                        regionId: o.regionId,
                        bio: o.bio,
                      })
                    }
                    className={`${linkCls} disabled:opacity-50`}
                  >
                    {creatingKey === o.key ? "Creating…" : "+ Create shadow profile"}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {uncovered.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
                No organisation listed
              </p>
              {uncovered.map((r) => (
                <div key={r.regionId} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {r.name}{" "}
                    <span className="text-muted-foreground">
                      · {r.artistCount} artist{r.artistCount === 1 ? "" : "s"}
                    </span>
                  </span>
                  {r.org ? (
                    <span className="text-muted-foreground">{r.org.name}</span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const name = window.prompt(`Name of the regional arts organisation for ${r.name}`);
                        if (!name?.trim()) return;
                        create(r.slug, {
                          name,
                          entityType: "partner",
                          orgCategory: "regional_arts_org",
                          regionId: r.regionId,
                        });
                      }}
                      className={`${linkCls} disabled:opacity-50`}
                    >
                      + Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            An organisation anchors its region&apos;s page, so every artist in that region is already
            attached the moment its profile exists. Send it a claim link from Claim Tokens.
          </p>
        </aside>
      </div>

      <section className="border-t border-border pt-4">
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          aria-expanded={listOpen}
          className="flex w-full items-center justify-between py-1 text-left"
        >
          <span className="text-sm font-semibold">All profiles ({artists.length})</span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${listOpen ? "rotate-180" : ""}`}
          />
        </button>
        {listOpen && (
          <div className="pt-4">
            <ArtistTable artists={artists} cities={cities} boards={boards} />
          </div>
        )}
      </section>
    </div>
  );
}
