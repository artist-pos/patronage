"use client";

import { useState } from "react";
import { Pencil, X, Check, ChevronUp, ChevronDown, EyeOff, Eye } from "lucide-react";
import { uploadImage } from "@/lib/upload-image";
import { updateActivationType } from "@/app/partners/actions";
import type { ActivationType } from "@/app/partners/page";

// "Art on your surfaces" grid on /partners. Public users see active tiles;
// admins get inline editing (photo swap, title, hide/show, reorder) wired to
// the existing updateActivationType action — replaces the editor that lived
// in the retired ActivationsColumn.

const TILE_GRADIENTS = [
  "linear-gradient(135deg,#8a4a2a,#c06030)",
  "linear-gradient(135deg,#0d1f2d,#1a3a4a)",
  "linear-gradient(135deg,#1a1a2e,#3a2a5a)",
  "linear-gradient(135deg,#142e38,#1e4858)",
  "linear-gradient(135deg,#cc4400,#ff6622)",
  "linear-gradient(135deg,#3a3a2a,#5a5a3a)",
];

const FALLBACK_TILES = [
  "Construction hoardings",
  "Billboards",
  "Fleet / truck curtains",
  "Utility boxes",
  "Bus shelters",
  "Vacant shopfronts",
];

const ADMIN_BTN =
  "flex h-7 w-7 items-center justify-center bg-black/60 text-white transition-colors hover:bg-black disabled:opacity-40";

// Timestamped storage path so replaced photos bust any cached URL
function uploadPath(id: string): string {
  return `${Date.now()}-${id}.webp`;
}

interface Props {
  tiles: ActivationType[];
  isAdmin: boolean;
}

export function ActivationTiles({ tiles: initial, isAdmin }: Props) {
  const [tiles, setTiles] = useState<ActivationType[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftImage, setDraftImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = isAdmin ? tiles : tiles.filter((t) => t.is_active);

  function startEdit(tile: ActivationType) {
    setEditingId(tile.id);
    setDraftTitle(tile.title);
    setDraftImage(tile.image_url);
    setError(null);
  }

  async function handleUpload(file: File, id: string) {
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadImage(file, {
        bucket: "activation-images",
        path: uploadPath(id),
        quality: 90,
      });
      if (url) setDraftImage(url);
    } catch {
      setError("Upload failed. Try a smaller image.");
    }
    setUploading(false);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    const result = await updateActivationType(id, {
      title: draftTitle.trim() || undefined,
      image_url: draftImage,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTiles((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, title: draftTitle.trim() || t.title, image_url: draftImage } : t
      )
    );
    setEditingId(null);
  }

  async function toggleVisible(tile: ActivationType) {
    const next = !tile.is_active;
    setTiles((prev) => prev.map((t) => (t.id === tile.id ? { ...t, is_active: next } : t)));
    await updateActivationType(tile.id, { is_active: next });
  }

  async function move(id: string, dir: "up" | "down") {
    const idx = tiles.findIndex((t) => t.id === id);
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= tiles.length) return;
    const next = [...tiles];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const renumbered = next.map((t, i) => ({ ...t, sort_order: i + 1 }));
    setTiles(renumbered);
    await Promise.all([
      updateActivationType(renumbered[idx].id, { sort_order: renumbered[idx].sort_order }),
      updateActivationType(renumbered[swap].id, { sort_order: renumbered[swap].sort_order }),
    ]);
  }

  // No rows yet — show the design's placeholder tiles (not editable)
  if (visible.length === 0 && !isAdmin) {
    return (
      <div className="mb-9 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FALLBACK_TILES.map((title, i) => (
          <div key={title} className="relative aspect-[4/3] overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ background: TILE_GRADIENTS[i % TILE_GRADIENTS.length] }}
            />
            <TileCaption title={title} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-9 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((tile, i) => {
        const editing = editingId === tile.id;
        const imgSrc = editing ? draftImage : tile.image_url;
        const img = imgSrc ?? null;
        return (
          <div
            key={tile.id}
            className={`relative aspect-[4/3] overflow-hidden ${
              isAdmin && !tile.is_active ? "opacity-50" : ""
            }`}
          >
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={img}
                alt={tile.title}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: TILE_GRADIENTS[i % TILE_GRADIENTS.length] }}
              />
            )}

            {!editing && <TileCaption title={tile.title} />}

            {/* Admin controls */}
            {isAdmin && !editing && (
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => move(tile.id, "up")}
                  disabled={i === 0}
                  aria-label="Move earlier"
                  className={ADMIN_BTN}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(tile.id, "down")}
                  disabled={i === visible.length - 1}
                  aria-label="Move later"
                  className={ADMIN_BTN}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisible(tile)}
                  aria-label={tile.is_active ? "Hide tile" : "Show tile"}
                  className={ADMIN_BTN}
                >
                  {tile.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(tile)}
                  aria-label={`Edit ${tile.title}`}
                  className={ADMIN_BTN}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Edit overlay */}
            {isAdmin && editing && (
              <div className="absolute inset-0 flex flex-col justify-between bg-black/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full border border-white/40 bg-black/40 px-2.5 py-1.5 text-[13px] text-white outline-none placeholder:text-white/50 focus:border-white"
                    placeholder="Tile title"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel"
                    className={ADMIN_BTN}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <label className="cursor-pointer border border-white/40 px-3 py-1.5 font-mono text-[11px] text-white transition-colors hover:border-white">
                    {uploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(f, tile.id);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => saveEdit(tile.id)}
                    disabled={saving || uploading}
                    className="flex items-center gap-1.5 bg-white px-3 py-1.5 font-mono text-[11px] text-black transition-opacity hover:opacity-85 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
                {error && (
                  <p className="absolute bottom-11 left-3 right-3 font-mono text-[10px] text-red-300">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TileCaption({ title }: { title: string }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 px-3.5 py-3"
      style={{ background: "linear-gradient(to top, rgba(0,0,0,.75), transparent)" }}
    >
      <span className="font-mono text-[11px] text-white">{title}</span>
    </div>
  );
}
