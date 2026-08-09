"use client";

import { useTransition, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  toggleArtistActive,
  togglePatronageSupported,
  deleteArtist,
  setArtistCountry,
} from "@/app/admin/artists/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ALL_COUNTRIES as COUNTRIES } from "@/lib/constants/countries";
import type { Profile } from "@/types/database";

const UNSET = "__unset";

export function ArtistTable({ artists }: { artists: Profile[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  // Optimistic country values — the select shouldn't snap back while the
  // server action is in flight.
  const [countryEdits, setCountryEdits] = useState<Record<string, string | null>>({});

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const countryOf = (a: Profile) =>
    a.id in countryEdits ? countryEdits[a.id] : a.country;

  function changeCountry(id: string, value: string) {
    const next = value === UNSET ? null : value;
    setCountryEdits((prev) => ({ ...prev, [id]: next }));
    startTransition(async () => {
      const result = await setArtistCountry(id, next);
      if (result?.error) {
        // Roll back to whatever the server still holds
        setCountryEdits((prev) => {
          const copy = { ...prev };
          delete copy[id];
          return copy;
        });
        window.alert(result.error);
      }
      router.refresh();
    });
  }

  const countryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of artists) {
      const c = (a.id in countryEdits ? countryEdits[a.id] : a.country) ?? UNSET;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [artists, countryEdits]);

  const q = search.trim().toLowerCase();
  const filtered = artists.filter((a) => {
    if (countryFilter !== "all" && (countryOf(a) ?? UNSET) !== countryFilter) return false;
    if (q && !a.username?.toLowerCase().includes(q) && !a.full_name?.toLowerCase().includes(q))
      return false;
    return true;
  });

  return (
    <>
      {/* Toolbar — find the untagged accounts fast */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search username or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-52 border border-border bg-background py-1.5 pl-6 pr-2 text-xs focus:border-black focus:outline-none"
          />
        </div>

        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="border border-border bg-background px-2 py-1.5 text-xs focus:border-black focus:outline-none"
        >
          <option value="all">All countries ({artists.length})</option>
          <option value={UNSET}>Not set ({countryCounts.get(UNSET) ?? 0})</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c} ({countryCounts.get(c) ?? 0})
            </option>
          ))}
        </select>

        {filtered.length !== artists.length && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {artists.length} shown
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-3 pr-4 font-medium text-muted-foreground w-40">Username</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Name</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Country</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Stage</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Active</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Supported</th>
              <th className="py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-border group">
                <td className="py-3 pr-4 font-mono">
                  <a
                    href={`/${a.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {a.username}
                  </a>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{a.full_name ?? "—"}</td>
                <td className="py-3 pr-4">
                  <select
                    value={countryOf(a) ?? UNSET}
                    disabled={isPending}
                    onChange={(e) => changeCountry(a.id, e.target.value)}
                    aria-label={`Country for ${a.username}`}
                    title="NZ/AUS show in the directory; anything else shows under International"
                    className={`border px-1.5 py-1 text-xs focus:border-black focus:outline-none disabled:opacity-50 ${
                      countryOf(a)
                        ? "border-border bg-background"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    <option value={UNSET}>— Not set —</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{a.career_stage ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant={a.is_active ? "outline" : "default"}
                    disabled={isPending}
                    onClick={() => act(() => toggleArtistActive(a.id, a.is_active))}
                    className="text-xs h-7 px-2"
                  >
                    {a.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant={a.is_patronage_supported ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() =>
                      act(() => togglePatronageSupported(a.id, a.is_patronage_supported))
                    }
                    className="text-xs h-7 px-2"
                  >
                    {a.is_patronage_supported ? "Supported ✓" : "Mark supported"}
                  </Button>
                </td>
                <td className="py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setDeleteTarget(a)}
                    className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {artists.length === 0 ? "No artists yet." : "No artists match these filters."}
          </p>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete artist</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <strong>{deleteTarget?.username}</strong>? This removes their
              profile and all portfolio images. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isPending}
              onClick={() => {
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                act(() => deleteArtist(id));
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
