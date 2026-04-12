"use client";

import { useState } from "react";
import { Users, Plus, Trash2, Crown, LogOut } from "lucide-react";
import { createCollective, leaveCollective, deleteCollective } from "@/app/profile/collective-actions";
import type { CollectiveMember } from "@/types/database";

interface Props {
  userId: string;
  initialMemberships: CollectiveMember[];
}

export function CollectivesManager({ userId, initialMemberships }: Props) {
  const [memberships, setMemberships] = useState<CollectiveMember[]>(initialMemberships);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const result = await createCollective({ name: name.trim(), description: description.trim() || undefined });
    if (result.error) {
      showToast(result.error);
    } else {
      // Add optimistically with a temp membership object
      const newMembership: CollectiveMember = {
        id: crypto.randomUUID(),
        collective_id: result.id!,
        user_id: userId,
        role: "admin",
        joined_at: new Date().toISOString(),
        collective: {
          id: result.id!,
          name: name.trim(),
          description: description.trim() || null,
          created_by: userId,
          created_at: new Date().toISOString(),
        },
      };
      setMemberships(prev => [...prev, newMembership]);
      setName("");
      setDescription("");
      setShowForm(false);
      showToast("Collective created.");
    }
    setSaving(false);
  }

  async function handleLeave(collectiveId: string) {
    const result = await leaveCollective(collectiveId);
    if (result.error) {
      showToast(result.error);
    } else {
      setMemberships(prev => prev.filter(m => m.collective_id !== collectiveId));
      showToast("Left collective.");
    }
  }

  async function handleDelete(collectiveId: string) {
    const result = await deleteCollective(collectiveId);
    if (result.error) {
      showToast(result.error);
    } else {
      setMemberships(prev => prev.filter(m => m.collective_id !== collectiveId));
      showToast("Collective deleted.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="text-sm text-muted-foreground border border-border px-3 py-2">
          {toast}
        </div>
      )}

      {/* Existing memberships */}
      {memberships.length > 0 ? (
        <div className="divide-y divide-border border border-border">
          {memberships.map(m => (
            <div key={m.id} className="flex items-start justify-between px-4 py-3 gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  <Users className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.collective?.name ?? "Unnamed"}</p>
                  {m.collective?.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {m.collective.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    {m.role === "admin" ? (
                      <>
                        <Crown className="w-3 h-3" />
                        Admin
                      </>
                    ) : (
                      "Member"
                    )}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {m.role === "admin" ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(m.collective_id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleLeave(m.collective_id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Leave
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <p className="text-sm text-muted-foreground">
            You are not part of any collectives yet. Create one below to group your practice with other artists.
          </p>
        )
      )}

      {/* Create form */}
      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 border border-border p-4">
          <p className="text-sm font-medium">New collective</p>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Auckland Print Collective"
              className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A brief description of your group…"
              rows={2}
              className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="text-sm bg-black text-white px-4 py-2 hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(""); setDescription(""); }}
              className="text-sm px-4 py-2 border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm border border-border px-4 py-2 hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create a collective
        </button>
      )}
    </div>
  );
}
