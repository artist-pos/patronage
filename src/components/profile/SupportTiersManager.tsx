"use client";

import { useState } from "react";
import { Pencil, Check, X, ChevronDown, ChevronUp, Mail, Send } from "lucide-react";
import {
  createSupportTier,
  updateSupportTier,
  deleteSupportTier,
  toggleSupportTierActive,
  getSupportIntentsForProfile,
  broadcastToSupporters,
} from "@/app/profile/support-tier-actions";
import type { SupportTier, SupportTierType } from "@/types/database";

interface Props {
  initialTiers: SupportTier[];
}

const TIER_TYPE_LABELS: Record<SupportTierType, string> = {
  one_off: "One-Off",
  recurring: "Recurring",
  service: "Service",
  project: "Project",
};

const PRESETS: Array<{ type: SupportTierType; name: string; title: string; price: number; description: string }> = [
  {
    type: "one_off",
    name: "The Micro-Grant",
    title: "The Micro-Grant",
    price: 25,
    description: "Fuel for the next week of production.",
  },
  {
    type: "recurring",
    name: "The Studio Member",
    title: "The Studio Member",
    price: 15,
    description: "Monthly access to the raw R&D.",
  },
  {
    type: "service",
    name: "The Print Club",
    title: "The Print Club",
    price: 50,
    description: "A physical portfolio building over time.",
  },
  {
    type: "project",
    name: "The Production Partner",
    title: "The Production Partner",
    price: 200,
    description: "Enabling a specific, measurable public outcome.",
  },
];

const inputCls =
  "w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black";

interface TierFormState {
  title: string;
  price: string;
  description: string;
  tier_type: SupportTierType | "";
}

type IntentRow = { id: string; tier_id: string; email: string; created_at: string };

const EMPTY_FORM: TierFormState = { title: "", price: "", description: "", tier_type: "" };

export function SupportTiersManager({ initialTiers }: Props) {
  const [tiers, setTiers] = useState<SupportTier[]>(initialTiers);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TierFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TierFormState>(EMPTY_FORM);

  // Intent dashboard
  const [intents, setIntents] = useState<IntentRow[] | null>(null);
  const [loadingIntents, setLoadingIntents] = useState(false);
  const [showIntents, setShowIntents] = useState(false);

  // Broadcast
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  function applyPreset(preset: typeof PRESETS[0]) {
    setForm({ title: preset.title, price: String(preset.price), description: preset.description, tier_type: preset.type });
    setShowForm(true);
  }

  function startEdit(tier: SupportTier) {
    setEditingId(tier.id);
    setEditForm({
      title: tier.title,
      price: String(tier.price),
      description: tier.description ?? "",
      tier_type: tier.tier_type ?? "",
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.price) return;
    setSaving(true);
    setFormError(null);
    const result = await createSupportTier({
      title: form.title.trim(),
      price: parseFloat(form.price),
      description: form.description.trim() || undefined,
      tier_type: form.tier_type || undefined,
    });
    if (result.error) {
      setFormError(result.error);
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
        tier_type: (form.tier_type as SupportTierType) || null,
        sort_order: prev.length,
        is_active: true,
        created_at: new Date().toISOString(),
      } satisfies SupportTier,
    ]);
    setForm(EMPTY_FORM);
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
      tier_type: (editForm.tier_type as SupportTierType) || null,
    });
    if (!result.error) {
      setTiers(prev =>
        prev.map(t =>
          t.id === tierId
            ? {
                ...t,
                title: editForm.title.trim(),
                price: parseFloat(editForm.price),
                description: editForm.description.trim() || null,
                tier_type: (editForm.tier_type as SupportTierType) || null,
              }
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

  async function handleLoadIntents() {
    if (intents !== null) {
      setShowIntents(v => !v);
      return;
    }
    setLoadingIntents(true);
    const result = await getSupportIntentsForProfile();
    setIntents(result.intents ?? []);
    setShowIntents(true);
    setLoadingIntents(false);
  }

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    const result = await broadcastToSupporters(broadcastMsg.trim());
    if (result.error) {
      setBroadcastResult(`Error: ${result.error}`);
    } else {
      setBroadcastResult(
        result.sent === 0
          ? "No supporter emails to send to yet."
          : `Sent to ${result.sent} supporter${result.sent !== 1 ? "s" : ""}.`
      );
      setBroadcastMsg("");
      setShowBroadcast(false);
    }
    setBroadcasting(false);
    setTimeout(() => setBroadcastResult(null), 5000);
  }

  // Group intents by tier for the dashboard
  const intentsByTier = (intents ?? []).reduce<Record<string, IntentRow[]>>((acc, i) => {
    (acc[i.tier_id] ??= []).push(i);
    return acc;
  }, {});
  const totalIntents = (intents ?? []).length;

  return (
    <div className="space-y-6" id="support-tiers">

      {/* Existing tiers */}
      {tiers.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {tiers.map(tier => (
            <div key={tier.id}>
              {editingId === tier.id ? (
                <div className="py-3 space-y-3">
                  <TierForm
                    form={editForm}
                    setForm={setEditForm}
                    inputCls={inputCls}
                  />
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
                    <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{tier.title}</p>
                      {tier.tier_type && (
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">
                          {TIER_TYPE_LABELS[tier.tier_type]}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      NZD {tier.price.toLocaleString("en-NZ")}
                      {tier.description ? ` — ${tier.description}` : ""}
                      {!tier.is_active && " · Hidden"}
                    </p>
                    {/* Intent count badge */}
                    {intents !== null && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {(intentsByTier[tier.id] ?? []).length} interested
                      </p>
                    )}
                    {/* Intent email list under this tier */}
                    {showIntents && intents !== null && (intentsByTier[tier.id] ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(intentsByTier[tier.id] ?? []).map(i => (
                          <p key={i.id} className="text-[11px] text-muted-foreground font-mono">{i.email}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-[11px]">
                    <button onClick={() => startEdit(tier)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3 h-3" />Edit
                    </button>
                    <span className="text-border">·</span>
                    <button onClick={() => handleToggleActive(tier)} disabled={busy === tier.id} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                      {tier.is_active ? "Hide" : "Show"}
                    </button>
                    <span className="text-border">·</span>
                    <button onClick={() => handleDelete(tier.id)} disabled={busy === tier.id} className="text-destructive hover:opacity-70 transition-opacity disabled:opacity-40">
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

      {/* Intent dashboard + broadcast row */}
      {tiers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleLoadIntents}
            disabled={loadingIntents}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {showIntents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <Mail className="w-3.5 h-3.5" />
            {loadingIntents ? "Loading…" : showIntents ? `Hide supporters (${totalIntents})` : "See interested supporters"}
          </button>
          <span className="text-border text-xs">·</span>
          <button
            type="button"
            onClick={() => setShowBroadcast(v => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            Email supporters
          </button>
          {broadcastResult && (
            <span className="text-xs text-muted-foreground">{broadcastResult}</span>
          )}
        </div>
      )}

      {/* Broadcast form */}
      {showBroadcast && (
        <form onSubmit={handleBroadcast} className="space-y-3 border border-border p-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Email all supporters</p>
          <p className="text-xs text-muted-foreground">
            This will send an email to everyone who has expressed interest in any of your tiers. Keep it personal and relevant — they signed up because they care about your work.
          </p>
          <textarea
            value={broadcastMsg}
            onChange={e => setBroadcastMsg(e.target.value)}
            rows={5}
            placeholder="Write your message here…"
            className={`${inputCls} resize-none`}
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={broadcasting || !broadcastMsg.trim()}
              className="text-sm bg-black text-white px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
            >
              {broadcasting ? "Sending…" : "Send to supporters"}
            </button>
            <button
              type="button"
              onClick={() => { setShowBroadcast(false); setBroadcastMsg(""); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Preset grid */}
      {!showForm && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Quick start</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRESETS.map(preset => {
              const alreadyAdded = tiers.some(t => t.title === preset.title);
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  disabled={alreadyAdded}
                  className="text-left border border-border p-3 hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{TIER_TYPE_LABELS[preset.type]}</span>
                  </div>
                  <p className="text-xs font-medium">{preset.name}</p>
                  <p className="text-[11px] text-muted-foreground italic">&ldquo;{preset.description}&rdquo;</p>
                  <p className="text-[11px] text-muted-foreground">NZD {preset.price}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom add form */}
      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 border border-border p-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">New Tier</p>
          <TierForm form={form} setForm={setForm} inputCls={inputCls} />
          {formError && <p className="text-xs text-destructive">{formError}</p>}
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
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null); }}
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

// Shared form fields (used for both create and edit)
function TierForm({
  form,
  setForm,
  inputCls,
}: {
  form: { title: string; price: string; description: string; tier_type: SupportTierType | "" };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; price: string; description: string; tier_type: SupportTierType | "" }>>;
  inputCls: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2 space-y-1">
        <label className="text-[11px] text-muted-foreground">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. The Studio Member"
          className={inputCls}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">Type</label>
        <select
          value={form.tier_type}
          onChange={e => setForm(f => ({ ...f, tier_type: e.target.value as SupportTierType | "" }))}
          className={inputCls}
        >
          <option value="">— select type —</option>
          <option value="one_off">One-Off</option>
          <option value="recurring">Recurring</option>
          <option value="service">Service</option>
          <option value="project">Project</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">Price (NZD)</label>
        <input
          type="number"
          value={form.price}
          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          placeholder="25"
          min="1"
          step="0.01"
          className={inputCls}
          required
        />
      </div>
      <div className="col-span-2 space-y-1">
        <label className="text-[11px] text-muted-foreground">Description</label>
        <input
          type="text"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="What supporters receive"
          className={inputCls}
        />
      </div>
    </div>
  );
}
