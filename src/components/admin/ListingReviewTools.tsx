"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  OpportunityForm,
  oppToFormData,
  type OpportunityFormData,
} from "@/components/opportunities/OpportunityForm";
import { saveOutreachDetails, updateQueueOpportunity } from "@/app/admin/opportunities/queue/actions";
import { CURRENT_TOOL_OPTIONS, outreachMissingFor } from "@/lib/claim-outreach";
import { buildOpportunityPayload } from "@/lib/opportunity-payload";
import { detectApplicationTool } from "@/lib/application-tool";
import type { Opportunity } from "@/types/database";

/**
 * The review tools the Scraper Queue and Submissions share: claim outreach
 * details, the full listing editor, and a preview link. One copy, so the two
 * review screens can't drift apart.
 */

/** The outreach fields as the server stores them, so a card reflects a save made in the full editor. */
export function outreachPatch(d: OpportunityFormData): Partial<Opportunity> {
  return {
    claim_email: d.claimEmail.trim().toLowerCase() || null,
    claim_contact_name: d.claimContactName.trim() || null,
    claim_current_tool: d.claimCurrentTool.trim() || null,
  };
}

/** Listings with no organisation behind them need contact details before they can go live. */
export const outreachMissing = outreachMissingFor;

/**
 * Preview by id, in a new tab. The detail page shows unpublished listings to
 * admins without redirecting to the placeholder slug, and nothing about the
 * listing is changed by looking at it.
 */
export function PreviewLink({ id, className }: { id: string; className?: string }) {
  return (
    <a
      href={`/opportunities/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "text-xs text-muted-foreground hover:text-foreground transition-colors"}
    >
      Preview ↗
    </a>
  );
}

/**
 * Who to contact about a listing nobody has claimed, and how they take
 * applications today. Required before approval: it feeds the claim CSV, the
 * invite panel and the daily claim emails.
 */
export function OutreachFields({
  opp,
  onSaved,
  listId = "outreach-current-tools",
}: {
  opp: Opportunity;
  onSaved: (patch: Partial<Opportunity>) => void;
  listId?: string;
}) {
  const [email, setEmail] = useState(opp.claim_email ?? opp.contact_email ?? opp.submitter_email ?? "");
  const [name, setName] = useState(opp.claim_contact_name ?? "");
  // Nothing saved yet: offer a guess from the apply link, which only counts once saved.
  const [tool, setTool] = useState(opp.claim_current_tool ?? detectApplicationTool(opp.url, "", !!opp.contact_email && !opp.url) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = outreachMissing(opp);
  const dirty =
    email.trim() !== (opp.claim_email ?? "") ||
    name.trim() !== (opp.claim_contact_name ?? "") ||
    tool.trim() !== (opp.claim_current_tool ?? "") ||
    (!opp.claim_email && !!email.trim());
  const cell = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:border-black";

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveOutreachDetails(opp.id, { email, contactName: name, currentTool: tool });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onSaved({
      claim_email: email.trim().toLowerCase(),
      claim_contact_name: name.trim(),
      claim_current_tool: tool.trim(),
    });
  }

  return (
    <div className={`rounded-lg border p-3 ${missing.length ? "border-amber-300 bg-amber-50/50" : "border-border bg-stone-50/60"}`}>
      <p className="mb-2 text-xs font-medium">
        Claim outreach{" "}
        <span className="font-normal text-muted-foreground">
          {missing.length ? `· needed before approval: ${missing.join(", ")}` : "· saved, ready for the claim email"}
        </span>
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Contact email"
          aria-label="Contact email"
          className={cell}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, or ‘team’ for a general inbox"
          aria-label="Contact name"
          className={cell}
        />
        <input
          list={listId}
          value={tool}
          onChange={(e) => setTool(e.target.value)}
          placeholder="How they take applications now"
          aria-label="Current application tool"
          className={cell}
        />
      </div>
      <datalist id={listId}>
        {CURRENT_TOOL_OPTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-md border border-black px-2.5 py-1 text-xs transition-colors hover:bg-black hover:text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save details"}
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </div>
  );
}

/** The full admin editor, inline under a review card. */
export function ListingEditor({
  opp,
  onDone,
  onSaved,
  onApprove,
  approveLabel = "Save & approve",
}: {
  opp: Opportunity;
  onDone: () => void;
  onSaved: (patch: Partial<Opportunity>) => void;
  /** Runs after a successful save; return an error to keep the editor open. */
  onApprove?: () => Promise<{ error?: string }>;
  approveLabel?: string;
}) {
  const [formData, setFormData] = useState<OpportunityFormData>(() => oppToFormData(opp));
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const supabase = createClient();

  function update(updates: Partial<OpportunityFormData>) {
    setFormData((prev) => ({ ...prev, ...updates }));
  }

  function flash(message: string, ms = 4000) {
    setToast(message);
    setTimeout(() => setToast(null), ms);
  }

  async function handleImgUpload(file: File): Promise<string | null> {
    const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const { error } = await supabase.storage
      .from("opportunity-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("opportunity-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function save() {
    await updateQueueOpportunity(opp.id, buildOpportunityPayload(formData, { admin: true }));
    onSaved({
      ...outreachPatch(formData),
      title: formData.title.trim() || opp.title,
      organiser: formData.organiser.trim() || opp.organiser,
      caption: formData.caption.trim() || null,
      deadline: formData.deadline || null,
      type: formData.type as Opportunity["type"],
      country: formData.country as Opportunity["country"],
      featured_image_url: formData.featuredImageUrl.trim() || null,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await save();
      flash("Saved", 5000);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndApprove() {
    if (!onApprove) return;
    setApproving(true);
    try {
      await save();
      const result = await onApprove();
      if (result.error) {
        flash(result.error, 6000);
        setApproving(false);
        return;
      }
      onDone();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Failed to save and approve");
      setApproving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-background p-4 sm:p-6">
      <OpportunityForm value={formData} onChange={update} mode="admin" onImgUpload={handleImgUpload} />

      <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 sm:px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={onDone} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Close
          </button>
          <PreviewLink id={opp.id} />
          {toast && (
            <p className={`text-xs ${toast === "Saved" ? "text-green-700" : "text-destructive"}`}>{toast}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || approving}
            className="rounded-lg border border-black px-3 py-1.5 text-xs transition-colors hover:bg-muted disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {onApprove && (
            <button
              onClick={handleSaveAndApprove}
              disabled={saving || approving || !formData.title.trim() || !formData.organiser.trim()}
              className="rounded-lg border border-black bg-black px-3 py-1.5 text-xs text-white transition-colors hover:bg-black/80 disabled:opacity-40"
            >
              {approving ? "Publishing…" : approveLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
