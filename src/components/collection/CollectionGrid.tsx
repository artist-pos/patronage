"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  bulkSetPublic,
  removeFromCollection,
  togglePublic,
} from "@/app/dashboard/collection/actions";
import type { CollectionEntry } from "@/lib/collection";

interface Props {
  entries: CollectionEntry[];
}

export function CollectionGrid({ entries }: Props) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCount = selected.size;
  const allSelected = useMemo(
    () => entries.length > 0 && selected.size === entries.length,
    [entries, selected],
  );

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.membership.id)));
  }

  function handleBulkPublish(isPublic: boolean) {
    if (selectedCount === 0) return;
    setBulkError(null);
    startTransition(async () => {
      const result = await bulkSetPublic(Array.from(selected), isPublic);
      if (result.error) {
        setBulkError(result.error);
        return;
      }
      setSelected(new Set());
      setSelectMode(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setSelectMode((m) => !m);
            setSelected(new Set());
            setBulkError(null);
          }}
          className="text-xs px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 transition-colors"
        >
          {selectMode ? "Done" : "Select"}
        </button>

        {selectMode && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs underline text-stone-700"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
            <span className="text-xs text-muted-foreground">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={() => handleBulkPublish(true)}
              disabled={isPending || selectedCount === 0}
              className="text-xs px-3 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-60"
            >
              Make public
            </button>
            <button
              type="button"
              onClick={() => handleBulkPublish(false)}
              disabled={isPending || selectedCount === 0}
              className="text-xs px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-60"
            >
              Make private
            </button>
          </div>
        )}
      </div>

      {bulkError && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{bulkError}</p>
      )}

      <ul className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {entries.map((entry) => (
          <CollectionTile
            key={entry.membership.id}
            entry={entry}
            selectMode={selectMode}
            isSelected={selected.has(entry.membership.id)}
            onToggleSelected={() => toggleSelected(entry.membership.id)}
          />
        ))}
      </ul>
    </div>
  );
}

interface TileProps {
  entry: CollectionEntry;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelected: () => void;
}

function CollectionTile({ entry, selectMode, isSelected, onToggleSelected }: TileProps) {
  // Optimistic toggle: flip locally, reconcile on server response. Toast keeps
  // failure visible without blocking the rest of the grid.
  const [isPublic, setIsPublic] = useState(entry.membership.is_public);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const artistName = entry.attributedArtist?.full_name ?? "Unknown artist";
  const thumb = entry.artwork.url;

  function handleTogglePublic() {
    const next = !isPublic;
    setIsPublic(next);
    setError(null);
    startTransition(async () => {
      const result = await togglePublic(entry.membership.id, next);
      if (result.error) {
        setIsPublic(!next);
        setError(result.error);
        setTimeout(() => setError(null), 3000);
      }
    });
  }

  function handleRemove() {
    if (!confirm(`Remove "${entry.artwork.title ?? "this work"}" from your collection?`)) return;
    startTransition(async () => {
      const result = await removeFromCollection(entry.membership.id);
      if (result.error) {
        setError(result.error);
        setTimeout(() => setError(null), 3000);
      }
    });
  }

  // In select mode the whole tile becomes a checkbox target so it's hard to
  // miss. Outside select mode the image acts as a link to the detail page.
  const imageEl = (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={thumb}
      alt={entry.artwork.title ?? artistName}
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );

  return (
    <li className="group relative">
      {selectMode ? (
        <button
          type="button"
          onClick={onToggleSelected}
          className={`block w-full aspect-square overflow-hidden rounded-md bg-stone-100 border-2 transition-colors ${
            isSelected ? "border-stone-900" : "border-transparent hover:border-stone-300"
          }`}
        >
          {imageEl}
          <span
            className={`absolute top-2 left-2 w-5 h-5 rounded border flex items-center justify-center text-[10px] ${
              isSelected
                ? "bg-stone-900 text-white border-stone-900"
                : "bg-white border-stone-300"
            }`}
          >
            {isSelected ? "✓" : ""}
          </span>
        </button>
      ) : (
        <Link
          href={`/dashboard/collection/${entry.membership.id}`}
          className="block aspect-square overflow-hidden rounded-md bg-stone-100"
        >
          {/* Plain <img> per CLAUDE.md — masonry/grid sizing fights with next/image. */}
          {imageEl}
        </Link>
      )}

      <div className="mt-1.5 space-y-0.5">
        <p className="text-xs font-medium truncate leading-tight">
          {entry.artwork.title ?? "Untitled"}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">{artistName}</p>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] gap-1">
        <button
          type="button"
          onClick={handleTogglePublic}
          disabled={isPending}
          className={`px-1.5 py-0.5 rounded-full border transition-colors ${
            isPublic
              ? "bg-stone-900 text-white border-stone-900"
              : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
          }`}
        >
          {isPublic ? "Public" : "Private"}
        </button>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/collection/${entry.membership.id}`}
            className="text-stone-500 hover:text-stone-900 transition-colors"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="text-stone-400 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </li>
  );
}
