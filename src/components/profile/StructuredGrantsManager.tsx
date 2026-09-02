"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, ExternalLink } from "lucide-react";
import { createGrantAction, deleteGrantAction, startProjectFromGrantAction } from "@/actions/grants";
import type { Grant } from "@/types/database";

const CURRENCIES = ["NZD", "AUD", "USD", "GBP", "EUR"];

function formatAmount(cents: number | null, currency: string): string {
  if (!cents) return "";
  return `${currency} ${(cents / 100).toLocaleString("en-NZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  initialGrants: Grant[];
}

export function StructuredGrantsManager({ initialGrants }: Props) {
  const router = useRouter();
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingProject, setStartingProject] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [organiser, setOrganiser] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [currency, setCurrency] = useState("NZD");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [notes, setNotes] = useState("");

  function resetForm() {
    setTitle("");
    setOrganiser("");
    setAmountStr("");
    setCurrency("NZD");
    setYear(String(new Date().getFullYear()));
    setNotes("");
    setError(null);
    setShowForm(false);
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const amountCents = amountStr.trim()
      ? Math.round(parseFloat(amountStr.replace(/,/g, "")) * 100) || null
      : null;
    const yearNum = year.trim() ? parseInt(year, 10) || null : null;

    const result = await createGrantAction({
      title: title.trim(),
      organiser: organiser.trim() || undefined,
      amount_cents: amountCents,
      currency,
      year: yearNum,
      notes: notes.trim() || undefined,
    });

    setSaving(false);
    if (result.error) { setError(result.error); return; }
    if (result.grant) setGrants(prev => [result.grant!, ...prev]);
    resetForm();
  }

  async function handleDelete(id: string) {
    const result = await deleteGrantAction(id);
    if (result.error) { setError(result.error); return; }
    setGrants(prev => prev.filter(g => g.id !== id));
  }

  async function handleStartProject(grant: Grant) {
    if (grant.project_id) {
      router.push("/studio?section=projects");
      return;
    }
    setStartingProject(grant.id);
    const result = await startProjectFromGrantAction(grant.id, grant.title);
    setStartingProject(null);
    if (result.error) { setError(result.error); return; }
    setGrants(prev => prev.map(g => g.id === grant.id ? { ...g, project_id: result.projectId ?? null } : g));
    router.push("/studio?section=projects");
  }

  return (
    <div className="space-y-4">
      {/* Grant list */}
      {grants.length > 0 && (
        <div className="space-y-3">
          {grants.map(grant => (
            <div key={grant.id} className="border border-border p-4 space-y-2 group relative">
              <button
                type="button"
                onClick={() => handleDelete(grant.id)}
                aria-label="Remove grant"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="pr-6">
                <p className="text-sm font-semibold leading-snug">{grant.title}</p>
                {grant.organiser && (
                  <p className="text-xs text-muted-foreground">{grant.organiser}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {grant.year && <span>{grant.year}</span>}
                {grant.amount_cents && (
                  <span className="font-medium text-foreground">
                    {formatAmount(grant.amount_cents, grant.currency)}
                  </span>
                )}
                {grant.notes && <span className="italic">{grant.notes}</span>}
              </div>

              <div className="pt-1">
                {grant.project_id ? (
                  <button
                    type="button"
                    onClick={() => router.push("/studio?section=projects")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View project →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartProject(grant)}
                    disabled={startingProject === grant.id}
                    className="text-xs border border-black px-2.5 py-1 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                  >
                    {startingProject === grant.id ? "Creating…" : "Start a project for this →"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="border border-black p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Add grant</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Grant / award title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Creative NZ Arts Practice Award"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Organiser / funder</label>
            <input
              type="text"
              value={organiser}
              onChange={e => setOrganiser(e.target.value)}
              placeholder="e.g. Creative New Zealand"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-[1fr_90px_80px] gap-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Amount</label>
              <input
                type="text"
                value={amountStr}
                onChange={e => setAmountStr(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Currency</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full border border-border px-2 py-2 text-sm focus:outline-none focus:border-black bg-background"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Year</label>
              <input
                type="text"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2026"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional, e.g. residency component"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="text-sm border border-black bg-black text-white px-4 py-2 hover:bg-white hover:text-black transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save grant"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add a grant or award
        </button>
      )}

      {error && !showForm && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
