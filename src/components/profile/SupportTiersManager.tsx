"use client";

import { useState } from "react";
import { createSupportTier, deleteSupportTier, toggleSupportTierActive } from "@/app/profile/support-tier-actions";
import type { SupportTier } from "@/types/database";

interface Props {
  initialTiers: SupportTier[];
}

const inputCls = "w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black";

export function SupportTiersManager({ initialTiers }: Props) {
  const [tiers, setTiers] = useState<SupportTier[]>(initialTiers);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !price) return;
    setSaving(true);
    setError(null);
    const result = await createSupportTier({
      title: title.trim(),
      price: parseFloat(price),
      description: description.trim() || undefined,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    // Optimistic add — server will have the real ID after refresh
    setTiers(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        profile_id: "",
        title: title.trim(),
        price: parseFloat(price),
        description: description.trim() || null,
        sort_order: prev.length,
        is_active: true,
        created_at: new Date().toISOString(),
      } satisfies SupportTier,
    ]);
    setTitle("");
    setPrice("");
    setDescription("");
    setShowForm(false);
    setSaving(false);
  }

  async function handleDelete(tierId: string) {
    if (!confirm("Delete this tier? Any captured intents will also be deleted.")) return;
    setBusy(tierId);
    const result = await deleteSupportTier(tierId);
    if (!result.error) {
      setTiers(prev => prev.filter(t => t.id !== tierId));
    }
    setBusy(null);
  }

  async function handleToggleActive(tier: SupportTier) {
    setBusy(tier.id);
    const result = await toggleSupportTierActive(tier.id, !tier.is_active);
    if (!result.error) {
      setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, is_active: !t.is_active } : t));
    }
    setBusy(null);
  }

  return (
    <div className="space-y-4" id="support-tiers">
      {tiers.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No tiers yet. Add one below.</p>
      )}

      {tiers.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {tiers.map(tier => (
            <div key={tier.id} className="flex items-center gap-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tier.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  NZD {tier.price.toLocaleString("en-NZ")}
                  {tier.description ? ` — ${tier.description}` : ""}
                  {!tier.is_active && " · Hidden"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <button
                  onClick={() => handleToggleActive(tier)}
                  disabled={busy === tier.id}
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  {tier.is_active ? "Hide" : "Show"}
                </button>
                <span className="text-border">·</span>
                <button
                  onClick={() => handleDelete(tier.id)}
                  disabled={busy === tier.id}
                  className="text-destructive hover:opacity-70 transition-opacity disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 border border-border p-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">New Tier</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Monthly support, Print edition"
                className={inputCls}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Price (NZD)</label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="20"
                min="1"
                step="0.01"
                className={inputCls}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What supporters receive"
                className={inputCls}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !title || !price}
              className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : "Add Tier"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
        >
          + Add tier
        </button>
      )}
    </div>
  );
}
