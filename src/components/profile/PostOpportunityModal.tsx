"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { postOpportunity } from "@/app/profile/opportunity-actions";
import type { Opportunity } from "@/types/database";

const TITLE_MAX = 140;
const DESC_MAX = 500;
const TYPES = ["Grant", "Commission", "Residency", "Open Call"] as const;

interface Props {
  onSuccess?: (opp: Opportunity) => void;
  triggerLabel?: string;
}

export function PostOpportunityModal({ onSuccess, triggerLabel = "+ Post Opportunity" }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<typeof TYPES[number]>("Grant");
  const [budget, setBudget] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(""); setType("Grant"); setBudget("");
    setDescription(""); setDeadline(""); setError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setSubmitting(true);
    setError(null);

    const result = await postOpportunity({ title, type, budget, description, deadline });
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const optimistic: Opportunity = {
      id: `opt-${Date.now()}`,
      title: title.trim(),
      organiser: "",
      description: description.trim() || null,
      caption: budget.trim() || null,
      full_description: null,
      type: type as Opportunity["type"],
      country: "Global",
      city: null,
      opens_at: null,
      deadline: deadline || null,
      url: null,
      funding_amount: null,
      funding_range: null,
      sub_categories: null,
      featured_image_url: null,
      grant_type: null,
      recipients_count: null,
      slug: null,
      is_active: true,
      status: "published",
      source_url: null,
      profile_id: null,
      created_at: new Date().toISOString(),
      entry_fee: null,
      artist_payment_type: null,
      travel_support: null,
      travel_support_details: null,
      view_count: 0,
      routing_type: "external",
      custom_fields: [],
      show_badges_in_submission: true,
      is_featured: false,
    };

    onSuccess?.(optimistic);
    setOpen(false);
  }

  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity font-medium"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) handleOpenChange(false); }}
        >
          <div className="bg-background border border-black w-full max-w-md mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Post an Opportunity</h2>
              <button
                onClick={() => handleOpenChange(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{title.length}/{TITLE_MAX}</span>
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                  placeholder="e.g. Community Arts Grant 2026"
                  className="w-full border border-black bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof TYPES[number])}
                  className="w-full border border-black bg-background px-3 py-2 text-sm focus:outline-none"
                >
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reward / Budget</label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. $5,000 or In-kind"
                  className="w-full border border-black bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{description.length}/{DESC_MAX}</span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                  rows={4}
                  placeholder="Eligibility, focus areas, how to apply…"
                  className="w-full border border-black bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground resize-none"
                />
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border border-black bg-transparent px-3 py-2 text-sm focus:outline-none"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={!canSubmit}>
                  {submitting ? "Posting…" : "Post Opportunity"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
