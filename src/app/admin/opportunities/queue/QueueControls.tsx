"use client";

import { useState } from "react";
import Image from "next/image";
import { approveOpportunity, rejectOpportunity, approveAll, rejectAll, updateQueueOpportunity } from "./actions";
import type { Opportunity } from "@/types/database";

interface Props {
  opps: Opportunity[];
  tab: string;
}

const TYPES = ["Grant", "Residency", "Commission", "Open Call", "Prize", "Display", "Job / Employment", "Studio / Space", "Public Art"];
const COUNTRIES = ["NZ", "AUS", "Global", "UK", "US", "EU"];

function EditForm({ opp, onDone }: { opp: Opportunity; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    title: opp.title,
    organiser: opp.organiser,
    caption: opp.caption ?? "",
    type: opp.type,
    country: opp.country,
    opens_at: opp.opens_at ?? "",
    deadline: opp.deadline ?? "",
    url: opp.url ?? "",
    funding_range: opp.funding_range ?? "",
    full_description: opp.full_description ?? "",
  });

  function set(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    await updateQueueOpportunity(opp.id, {
      title: values.title,
      organiser: values.organiser,
      caption: values.caption || null,
      type: values.type,
      country: values.country,
      opens_at: values.opens_at || null,
      deadline: values.deadline || null,
      url: values.url || null,
      funding_range: values.funding_range || null,
      full_description: values.full_description || null,
    });
    setSaving(false);
    onDone();
  }

  const inputCls = "w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-black";
  const selectCls = "w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-black";
  const labelCls = "block text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider";

  return (
    <div className="border-t border-border mt-3 pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Title</label>
          <input className={inputCls} value={values.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Organiser</label>
          <input className={inputCls} value={values.organiser} onChange={(e) => set("organiser", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <select className={selectCls} value={values.type} onChange={(e) => set("type", e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Country</label>
          <select className={selectCls} value={values.country} onChange={(e) => set("country", e.target.value)}>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Opens</label>
          <input type="date" className={inputCls} value={values.opens_at} onChange={(e) => set("opens_at", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Deadline</label>
          <input type="date" className={inputCls} value={values.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Funding</label>
          <input className={inputCls} value={values.funding_range} onChange={(e) => set("funding_range", e.target.value)} placeholder="e.g. $5,000" />
        </div>
      </div>

      <div>
        <label className={labelCls}>URL</label>
        <input className={inputCls} value={values.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" />
      </div>

      <div>
        <label className={labelCls}>Caption (≤160 chars)</label>
        <input
          className={inputCls}
          value={values.caption}
          maxLength={160}
          onChange={(e) => set("caption", e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">{values.caption.length}/160</p>
      </div>

      <div>
        <label className={labelCls}>Full description</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={4}
          value={values.full_description}
          onChange={(e) => set("full_description", e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !values.title.trim() || !values.organiser.trim()}
          className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          onClick={onDone}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function QueueControls({ opps, tab }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setLoading(id);
    await approveOpportunity(id);
    setLoading(null);
  }

  async function handleReject(id: string) {
    setLoading(`reject-${id}`);
    await rejectOpportunity(id);
    setLoading(null);
  }

  async function handleApproveAll() {
    setLoading("all");
    await approveAll(opps.map((o) => o.id));
    setLoading(null);
  }

  async function handleRejectAll() {
    setLoading("reject-all");
    await rejectAll(opps.map((o) => o.id));
    setLoading(null);
  }

  if (opps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        {tab === "pending" ? "Queue is empty — run the scraper to populate it." : "No rejected items."}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      {tab === "pending" && opps.length > 1 && (
        <div className="flex gap-3 text-xs">
          <button
            onClick={handleApproveAll}
            disabled={loading === "all"}
            className="border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
          >
            {loading === "all" ? "Approving…" : `Approve all ${opps.length}`}
          </button>
          <button
            onClick={handleRejectAll}
            disabled={loading === "reject-all"}
            className="border border-border px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          >
            {loading === "reject-all" ? "Rejecting…" : "Reject all"}
          </button>
        </div>
      )}

      {/* Items */}
      <div className="space-y-px">
        {opps.map((opp) => (
          <div
            key={opp.id}
            className="border border-border p-3 bg-background hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Thumbnail */}
              <div className="w-16 h-16 shrink-0 bg-muted border border-border overflow-hidden flex items-center justify-center">
                {opp.featured_image_url ? (
                  <Image
                    src={opp.featured_image_url}
                    alt={opp.title}
                    width={64}
                    height={64}
                    unoptimized
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground text-center px-1 leading-tight">
                    No image
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</p>
                <p className="text-xs text-muted-foreground">{opp.organiser}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-[10px] border border-border px-1.5 py-0.5 leading-none">{opp.type}</span>
                  <span className="text-[10px] border border-border px-1.5 py-0.5 leading-none">{opp.country}</span>
                  {opp.deadline && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Closes {opp.deadline}
                    </span>
                  )}
                  {opp.funding_range && (
                    <span className="text-[10px] font-mono font-bold">{opp.funding_range}</span>
                  )}
                </div>
                {opp.caption && (
                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mt-1">
                    {opp.caption}
                  </p>
                )}
                {opp.source_url && (
                  <a
                    href={opp.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {new URL(opp.source_url).hostname}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                {tab === "pending" ? (
                  <>
                    <button
                      onClick={() => handleApprove(opp.id)}
                      disabled={loading === opp.id}
                      className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40 whitespace-nowrap"
                    >
                      {loading === opp.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(opp.id)}
                      disabled={loading === `reject-${opp.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {loading === `reject-${opp.id}` ? "…" : "Reject"}
                    </button>
                    <button
                      onClick={() => setEditingId(editingId === opp.id ? null : opp.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {editingId === opp.id ? "Close" : "Edit"}
                    </button>
                    {opp.url && (
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center"
                      >
                        View →
                      </a>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleApprove(opp.id)}
                    disabled={loading === opp.id}
                    className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors disabled:opacity-40"
                  >
                    {loading === opp.id ? "…" : "Restore"}
                  </button>
                )}
              </div>
            </div>

            {/* Inline edit form */}
            {editingId === opp.id && (
              <EditForm opp={opp} onDone={() => setEditingId(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
