"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPriorHistoryEntry, deletePriorHistoryEntry } from "./actions";
import {
  PRIOR_HISTORY_TYPES,
  priorHistoryLabel,
  type PriorHistoryEntry,
  type PriorHistoryType,
} from "@/lib/artwork-prior-history";

interface Props {
  artworkId: string;
  initialEntries: PriorHistoryEntry[];
}

export function PriorHistoryEditor({ artworkId, initialEntries }: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState(false);

  const [type, setType] = useState<PriorHistoryType>("exhibited");
  const [description, setDescription] = useState("");
  const [dateText, setDateText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const result = await addPriorHistoryEntry({
      artworkId,
      type,
      description: description.trim(),
      dateText: dateText.trim() || null,
    });
    setSubmitting(false);
    if (result.error) {
      setSubmitError(result.error);
    } else {
      setDescription("");
      setDateText("");
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deletePriorHistoryEntry(id);
    setDeletingId(null);
    if (!result.error) {
      setEntries(prev => prev.filter(e => e.id !== id));
      router.refresh();
    }
  }

  return (
    <section className="border border-stone-200 rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-sm font-medium text-stone-900">Prior history</p>
          <p className="text-xs text-stone-500 mt-0.5">
            Exhibitions, sales, commissions and other events from before the work was registered on Patronage.{" "}
            <span className="text-stone-700">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-stone-100 px-5 py-5 space-y-5">
          {entries.length > 0 && (
            <ul className="space-y-2">
              {entries.map(e => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg bg-stone-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-stone-700">{priorHistoryLabel(e.type)}</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-200 text-stone-600">
                        Self-attested
                      </span>
                      {e.date_text && (
                        <span className="text-xs text-stone-400">· {e.date_text}</span>
                      )}
                    </div>
                    <p className="text-sm text-stone-700 mt-0.5 break-words">{e.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    disabled={deletingId === e.id}
                    className="text-xs text-stone-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t border-stone-100">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Add entry</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as PriorHistoryType)}
                  className="w-full h-10 px-2 border border-stone-200 rounded-lg text-sm bg-white"
                >
                  {PRIOR_HISTORY_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-stone-500 mb-1">Date</label>
                <input
                  type="text"
                  value={dateText}
                  onChange={e => setDateText(e.target.value)}
                  placeholder="e.g. 2003 or Spring 2010"
                  className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-stone-500 mb-1">Description</label>
              <input
                type="text"
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Group exhibition at Objectspace, Auckland"
                className="w-full h-10 px-3 border border-stone-200 rounded-lg text-sm"
              />
            </div>
            {submitError && <p className="text-xs text-red-600">{submitError}</p>}
            <button
              type="submit"
              disabled={submitting || !description.trim()}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add entry"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
