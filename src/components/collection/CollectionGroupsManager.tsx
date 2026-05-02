"use client";

import { useState, useTransition } from "react";
import { supabaseTransform } from "@/lib/image";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  bulkAssignToGroup,
} from "@/app/dashboard/collection/group-actions";
import type { CollectionGroup } from "@/types/database";
import type { CollectionEntry } from "@/lib/collection";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  groups: CollectionGroup[];
  entries: CollectionEntry[];
  username: string;
}

export function CollectionGroupsManager({ groups: initialGroups, entries, username }: Props) {
  const [groups, setGroups] = useState<CollectionGroup[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectingGroupId, setSelectingGroupId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function embedCode(groupId: string) {
    const src = `${SITE_URL}/embed/${username}/collection?group=${groupId}`;
    return `<iframe src="${src}" width="100%" height="600" frameborder="0" style="border:none;overflow:hidden" scrolling="no" title="${username} Collection — Patronage"></iframe>`;
  }

  function copyEmbed(groupId: string) {
    navigator.clipboard.writeText(embedCode(groupId));
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openSelector(group: CollectionGroup) {
    // Pre-select artworks already in this group
    const preSelected = new Set(
      entries
        .filter(e => e.membership.group_id === group.id)
        .map(e => e.membership.id)
    );
    setSelection(preSelected);
    setSelectingGroupId(group.id);
  }

  function closeSelector() {
    setSelectingGroupId(null);
    setSelection(new Set());
  }

  function handleSaveSelection(groupId: string) {
    setError(null);
    startTransition(async () => {
      const result = await bulkAssignToGroup(groupId, Array.from(selection));
      if (result.error) { setError(result.error); return; }
      closeSelector();
    });
  }

  function handleCreate() {
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createGroup(newName.trim());
      if (result.error) { setError(result.error); return; }
      setGroups(prev => [...prev, {
        id: result.id!,
        holder_id: "",
        name: newName.trim(),
        position: prev.length,
        created_at: new Date().toISOString(),
      }]);
      setNewName("");
    });
  }

  function handleRename(id: string) {
    if (!editName.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await updateGroup(id, editName.trim());
      if (result.error) { setError(result.error); return; }
      setGroups(prev => prev.map(g => g.id === id ? { ...g, name: editName.trim() } : g));
      setEditingId(null);
    });
  }

  function handleDelete(id: string) {
    setError(null);
    if (selectingGroupId === id) closeSelector();
    startTransition(async () => {
      const result = await deleteGroup(id);
      if (result.error) { setError(result.error); return; }
      setGroups(prev => prev.filter(g => g.id !== id));
    });
  }

  const assignedCount = (groupId: string) =>
    entries.filter(e => e.membership.group_id === groupId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Collections</h2>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No collections yet. Create one below to group works and get a dedicated embed code.
        </p>
      )}

      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.id} className="border border-border rounded-lg overflow-hidden">
            {/* Group row */}
            <div className="flex items-center gap-3 px-4 py-3">
              {editingId === group.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleRename(group.id); if (e.key === "Escape") setEditingId(null); }}
                    autoFocus
                    className="flex-1 text-sm border-b border-black bg-transparent focus:outline-none"
                  />
                  <button onClick={() => handleRename(group.id)} disabled={isPending} className="text-xs hover:opacity-70">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">
                    {group.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {assignedCount(group.id)} works
                    </span>
                  </span>
                  <button
                    onClick={() => selectingGroupId === group.id ? closeSelector() : openSelector(group)}
                    className="text-xs px-2.5 py-1 border border-stone-200 rounded hover:bg-stone-50 transition-colors"
                  >
                    {selectingGroupId === group.id ? "Done selecting" : "Select artworks"}
                  </button>
                  <button
                    onClick={() => copyEmbed(group.id)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedId === group.id ? "Copied!" : "Copy embed"}
                  </button>
                  <button
                    onClick={() => { setEditingId(group.id); setEditName(group.name); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    disabled={isPending}
                    className="text-xs text-red-500 hover:opacity-70 transition-opacity"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>

            {/* Artwork selector */}
            {selectingGroupId === group.id && (
              <div className="border-t border-border bg-stone-50 p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select the works to include in <strong>{group.name}</strong>. Works in other collections will be moved here.
                </p>
                <ul className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {entries.map(entry => {
                    const id = entry.membership.id;
                    const checked = selection.has(id);
                    const thumb = supabaseTransform(entry.artwork.url, { width: 200, quality: 70 }) ?? entry.artwork.url;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSelection(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id); else next.add(id);
                            return next;
                          })}
                          className={`w-full aspect-square overflow-hidden rounded border-2 transition-colors relative block ${
                            checked ? "border-black" : "border-transparent hover:border-stone-300"
                          }`}
                          title={entry.artwork.title ?? entry.attributedArtist?.full_name ?? "Untitled"}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                          {checked && (
                            <span className="absolute top-1 left-1 w-4 h-4 bg-black text-white rounded-sm flex items-center justify-center text-[9px]">✓</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveSelection(group.id)}
                    disabled={isPending}
                    className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                  >
                    {isPending ? "Saving…" : `Save — ${selection.size} works`}
                  </button>
                  <button
                    type="button"
                    onClick={closeSelector}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New group */}
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
          placeholder="New collection name…"
          className="flex-1 text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-black"
        />
        <button
          onClick={handleCreate}
          disabled={isPending || !newName.trim()}
          className="text-sm bg-foreground text-background rounded-lg px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Create
        </button>
      </div>
    </div>
  );
}
