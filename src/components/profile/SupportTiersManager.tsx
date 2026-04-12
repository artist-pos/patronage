"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import {
  createSupportTier,
  updateSupportTier,
  deleteSupportTier,
  toggleSupportTierActive,
} from "@/app/profile/support-tier-actions";
import type { SupportTier } from "@/types/database";

interface Props {
  initialTiers: SupportTier[];
}

const PRESETS = [
  { title: "Fan", price: 5, description: "Stay connected and support my practice." },
  { title: "Studio Supporter", price: 15, description: "Monthly support and studio updates." },
  { title: "Collector", price: 50, description: "Priority access to new works and editions." },
  { title: "Patron", price: 100, description: "Studio visits, early access, and collector recognition." },
];

const inputCls =
  "w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black";

interface TierFormState {
  title: string;
  price: string;
  description: string;
}

export function SupportTiersManager({ initialTiers }: Props) {
  const [tiers, setTiers] = useState<SupportTier[]>(initialTiers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TierFormState>({ title: "", price: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TierFormState>({ title: "", price: "", description: "" });

  function applyPreset(preset: typeof PRESETS[0]) {
    setForm({ title: preset.title, price: String(preset.price), description: preset.description });
    setShowForm(true);
  }

  function startEdit(tier: SupportTier) {
    setEditingId(tier.id);
    setEditForm({ title: tier.title, price: String(tier.price), description: tier.description ?? "" });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.price) return;
    setSaving(true);
    setError(null);
    const result = await createSupportTier({
      title: form.title.trim(),
      price: parseFloat(form.price),
      description: form.description.trim() || undefined,
    });
    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    setTiers(prev => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        profile_id: "",
        title: form.title.trim(),
        price: parseFloat(form.price),
        description: form.description.trim() || null,
        sort_order: prev.length,
        is_active: true,
        created_at: new Date().toISOString(),
      } satisfies SupportTier,
    ]);
    setForm({ title: "", price: "", description: "" });
    setShowForm(false);
    setSaving(false);
  }

  async function handleUpdate(tierId: string) {
    if (!editForm.title.trim() || !editForm.price) return;
    setBusy(tierId);
    const result = await updateSupportTier(tierId, {
      title: editForm.title.trim(),
      price: parseFloat(editForm.price),
      description: editForm.description.trim() || undefined,
    });
    if (!result.error) {
      setTiers(prev =>
        prev.map(t =>
          t.id === tierId
            ? { ...t, title: editForm.title.trim(), price: parseFloat(editForm.price), description: editForm.description.trim() || null }
            : t
        )
      );
      setEditingId(null);
    }
    setBusy(null);
  }

  async function handleDelete(tierId: string) {
    if (!confirm("Delete this tier? Any captured interest will also be deleted.")) return;
    setBusy(tierId);
    const result = await deleteSupportTier(tierId);
    if (!result.error) setTiers(prev => prev.filter(t => t.id !== tierId));
    setBusy(null);
  }

  async function handleToggleActive(tier: SupportTier) {
    setBusy(tier.id);
    const result = await toggleSupportTierActive(tier.id, !tier.is_active);
    if (!result.error) setTiers(prev => prev.map(t => t.id === tier.id ? { ...t, is_active: !t.is_active } : t));
    setBusy(null);
  }

  return (
    <div className="space-y-6" id="support-tiers">

      {/* Existing tiers */}
      {tiers.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {tiers.map(tier => (
            <div key={tier.id}>
              {editingId === tier.id ? (
                /* Inline edit form */
                <div className="py-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[11px] text-muted-foreground">Title</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Price (NZD)</label>
                      <input
                        type="number"
                        value={editForm.price}
                        onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                        min="1"
                        step="0.01"
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground">Description</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="What supporters receive"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(tier.id)}
                      disabled={busy === tier.id}
                      className="flex items-center gap-1.5 text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 disabled:opacity-40 transition-opacity"
                    >
                      <Check className="w-3 h-3" />
                      {busy === tier.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display row */
                <div className="flex items-center gap-4 py-3">
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
                      onClick={() => startEdit(tier)}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <span className="text-border">·</span>
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
              )}
            </div>
          ))}
        </div>
      )}

      {tiers.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">No tiers yet. Choose a starting point below or create a custom tier.</p>
      )}

      {/* Preset suggestions */}
      {!showForm && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Quick start</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRESETS.map(preset => {
              const alreadyAdded = tiers.some(t => t.title === preset.title);
              return (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  disabled={alreadyAdded}
                  className="text-left border border-border p-3 hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed space-y-1"
                >
                  <p className="text-xs font-medium">{preset.title}</p>
                  <p className="text-[11px] text-muted-foreground">NZD {preset.price}/mo</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add custom form */}
      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 border border-border p-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">New Tier</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Monthly support, Print edition"
                className={inputCls}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Price (NZD)</label>
              <input
                type="number"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
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
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What supporters receive"
                className={inputCls}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !form.title || !form.price}
              className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : "Add Tier"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ title: "", price: "", description: "" }); setError(null); }}
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
          + Custom tier
        </button>
      )}
    </div>
  );
}
