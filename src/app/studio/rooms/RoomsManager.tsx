"use client";

import { useState } from "react";
import { Copy, Check, Eye, EyeOff, Trash2 } from "lucide-react";
import { createPrivateRoom, deletePrivateRoom, toggleRoomActive } from "./actions";
import { useRouter } from "next/navigation";

interface AvailableArtwork {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
}

interface Room {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  show_prices: boolean;
  is_active: boolean;
  created_at: string;
  artwork_count: number;
}

interface Props {
  initialRooms: Room[];
  availableArtworks: AvailableArtwork[];
  username: string;
  siteUrl: string;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function RoomsManager({ initialRooms, availableArtworks, username, siteUrl }: Props) {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [showPrices, setShowPrices] = useState(true);
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function handleTitleChange(val: string) {
    setTitle(val);
    setSlug(slugify(val));
  }

  function toggleArtwork(id: string) {
    setSelectedArtworkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await createPrivateRoom({
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      showPrices,
      artworkIds: [...selectedArtworkIds],
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTitle(""); setSlug(""); setDescription(""); setShowPrices(true);
    setSelectedArtworkIds(new Set());
    setShowCreate(false);
    router.refresh();
  }

  function copyLink(slug: string, roomId: string) {
    const url = `${siteUrl}/${username}/rooms/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2500);
  }

  async function handleDelete(roomId: string) {
    if (!confirm("Delete this room? The link will stop working immediately.")) return;
    setBusy(roomId);
    const result = await deletePrivateRoom(roomId);
    if (!result.error) {
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
    }
    setBusy(null);
  }

  async function handleToggleActive(room: Room) {
    setBusy(room.id);
    const result = await toggleRoomActive(room.id, !room.is_active);
    if (!result.error) {
      setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, is_active: !r.is_active } : r));
    }
    setBusy(null);
  }

  return (
    <div className="space-y-8">
      {/* Existing rooms */}
      {rooms.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-start justify-between gap-4 py-4">
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{room.title}</p>
                  {!room.is_active && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono">
                  /{username}/rooms/{room.slug}
                </p>
                {room.description && (
                  <p className="text-[11px] text-muted-foreground">{room.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {room.artwork_count} work{room.artwork_count !== 1 ? "s" : ""}
                  {!room.show_prices && " · Prices hidden"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <button
                  type="button"
                  onClick={() => copyLink(room.slug, room.id)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedId === room.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedId === room.id ? "Copied" : "Copy link"}
                </button>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(room)}
                  disabled={busy === room.id}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  {room.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {room.is_active ? "Deactivate" : "Activate"}
                </button>
                <span className="text-border">·</span>
                <button
                  type="button"
                  onClick={() => handleDelete(room.id)}
                  disabled={busy === room.id}
                  className="flex items-center gap-1 text-destructive hover:opacity-70 transition-opacity disabled:opacity-40"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rooms.length === 0 && !showCreate && (
        <p className="text-sm text-muted-foreground">No viewing rooms yet. Create one to share a curated selection of works.</p>
      )}

      {/* Create form */}
      {showCreate ? (
        <form onSubmit={handleCreate} className="space-y-5 border border-border p-5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">New Viewing Room</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-stone-500">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Selected Works 2025"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
                required
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-stone-500">URL slug</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">/{username}/rooms/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="selected-works-2025"
                  className="flex-1 h-10 px-3 border border-stone-200 rounded-lg text-sm font-mono"
                  required
                />
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-stone-500">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A note for viewers"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrices}
              onChange={(e) => setShowPrices(e.target.checked)}
              className="accent-black"
            />
            <span className="text-xs text-stone-700">Show prices in this room</span>
          </label>

          {/* Work selection */}
          {availableArtworks.length > 0 && (
            <div className="space-y-2">
              <label className="block text-[11px] uppercase tracking-wider text-stone-500">
                Select works ({selectedArtworkIds.size} selected)
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-56 overflow-y-auto border border-stone-100 p-2">
                {availableArtworks.map((a) => {
                  const selected = selectedArtworkIds.has(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleArtwork(a.id)}
                      className={`relative aspect-square overflow-hidden border-2 transition-colors ${selected ? "border-black" : "border-transparent"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.url} alt={a.caption ?? ""} className="w-full h-full object-cover" />
                      {selected && (
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create room"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setError(null); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
        >
          + Create viewing room
        </button>
      )}
    </div>
  );
}
