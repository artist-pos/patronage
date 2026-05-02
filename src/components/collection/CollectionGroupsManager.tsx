"use client";

import { useState, useTransition } from "react";
import { createGroup, updateGroup, deleteGroup } from "@/app/dashboard/collection/group-actions";
import type { CollectionGroup } from "@/types/database";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

interface Props {
  groups: CollectionGroup[];
  username: string;
}

export function CollectionGroupsManager({ groups: initialGroups, username }: Props) {
  const [groups, setGroups] = useState<CollectionGroup[]>(initialGroups);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    startTransition(async () => {
      const result = await deleteGroup(id);
      if (result.error) { setError(result.error); return; }
      setGroups(prev => prev.filter(g => g.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400">Collections</h2>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No collections yet. Create one to group your works and get a dedicated embed.
        </p>
      )}

      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.id} className="flex items-center gap-3 border border-border rounded-lg px-4 py-3">
            {editingId === group.id ? (
              <>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRename(group.id); if (e.key === "Escape") setEditingId(null); }}
                  autoFocus
                  className="flex-1 text-sm border-b border-black bg-transparent focus:outline-none"
                />
                <button onClick={() => handleRename(group.id)} disabled={isPending} className="text-xs text-foreground hover:opacity-70">Save</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm font-medium">{group.name}</span>
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
