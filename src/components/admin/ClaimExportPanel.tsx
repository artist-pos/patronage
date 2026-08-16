"use client";

import { useEffect, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { prepareClaimExport, type ClaimExportRow } from "@/app/admin/opportunities/export-actions";
import type { Opportunity } from "@/types/database";

/** Suggestions only — the field is free text, type anything. */
const TOOL_OPTIONS = [
  "Website form",
  "Google Form",
  "Email",
  "CRM",
  "Submittable",
  "SmartyGrants",
  "Post / phone",
  "Unknown",
];

const EXPIRY_OPTIONS = [14, 30, 60, 90];

interface RowInput {
  orgName: string;
  contactName: string;
  email: string;
  listingName: string;
  description: string;
  currentTool: string;
  subjectSmiley: boolean;
}

/** Descriptions run to paragraphs — flatten so each CSV cell stays one line. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

interface Props {
  opps: Opportunity[];
  onClose: () => void;
  onExported: (msg: string) => void;
}

export function ClaimExportPanel({ opps, onClose, onExported }: Props) {
  const [expiryDays, setExpiryDays] = useState(30);
  const [rows, setRows] = useState<ClaimExportRow[] | null>(null);
  const [inputs, setInputs] = useState<Record<string, RowInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkTool, setBulkTool] = useState("");

  const ids = opps.map((o) => o.id).join(",");

  // Mint / extend the claim tokens for this batch, then seed the editable rows.
  useEffect(() => {
    let cancelled = false;
    prepareClaimExport(ids.split(","), expiryDays).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      const fetched = result.rows ?? [];
      setError(null);
      setRows(fetched);
      // Seed inputs once — re-preparing for a new expiry must not wipe typed values.
      setInputs((prev) => {
        const next = { ...prev };
        for (const r of fetched) {
          if (!next[r.id]) {
            next[r.id] = {
              orgName: r.organiser,
              contactName: "",
              email: "",
              listingName: r.title,
              description: flatten(r.description),
              currentTool: "",
              subjectSmiley: false,
            };
          }
        }
        return next;
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ids, expiryDays]);

  function update(id: string, patch: Partial<RowInput>) {
    setInputs((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function applyToolToAll() {
    if (!rows) return;
    setInputs((prev) => {
      const next = { ...prev };
      for (const r of rows) next[r.id] = { ...next[r.id], currentTool: bulkTool };
      return next;
    });
  }

  function setAllSmileys(value: boolean) {
    if (!rows) return;
    setInputs((prev) => {
      const next = { ...prev };
      for (const r of rows) next[r.id] = { ...next[r.id], subjectSmiley: value };
      return next;
    });
  }

  function exportCSV() {
    if (!rows) return;

    const headers = [
      "org_name",
      "contact_name",
      "email",
      "listing_name",
      "description",
      "listing_url",
      "claim_url",
      "current_tool",
      "subject_smiley",
    ];

    const csvRows = rows.map((r) => {
      const i = inputs[r.id];
      return [
        i.orgName.trim(),
        i.contactName.trim(),
        i.email.trim(),
        i.listingName.trim(),
        flatten(i.description),
        r.listingUrl,
        r.claimUrl,
        i.currentTool.trim(),
        i.subjectSmiley ? "yes" : "no",
      ];
    });

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...csvRows].map((row) => row.map(escape).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `patronage-claim-outreach-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    onExported(`Exported ${rows.length} listing${rows.length !== 1 ? "s" : ""} to CSV.`);
  }

  const missingEmail = rows?.filter((r) => !inputs[r.id]?.email.trim()).length ?? 0;
  const newTokens = rows?.filter((r) => r.tokenIsNew).length ?? 0;
  const ownedCount = rows?.filter((r) => r.alreadyOwned).length ?? 0;
  const firstExpiry = rows?.find((r) => r.claimTokenExpiresAt)?.claimTokenExpiresAt;
  const expiryDate = firstExpiry
    ? new Date(firstExpiry).toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const cell = "w-full border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:border-black";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border border-black w-full max-w-6xl mx-4 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-black/20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5">
              Export claim links
            </p>
            <p className="text-xs text-muted-foreground">
              {opps.length} listing{opps.length !== 1 ? "s" : ""} selected · fill in the outreach
              details, then export a CSV to hand to Claude Cowork
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-black/10 bg-muted/20">
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            Links valid for
            <select
              value={expiryDays}
              onChange={(e) => {
                setLoading(true);
                setExpiryDays(Number(e.target.value));
              }}
              className="text-xs border border-border px-2 py-1 bg-background focus:outline-none focus:border-black"
            >
              {EXPIRY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>

          <span className="text-black/15">|</span>

          <div className="flex items-center gap-1.5">
            <input
              list="claim-export-tools"
              value={bulkTool}
              onChange={(e) => setBulkTool(e.target.value)}
              placeholder="Set current tool for all…"
              className="text-xs border border-border px-2 py-1 bg-background focus:outline-none focus:border-black w-44"
            />
            <button
              type="button"
              onClick={applyToolToAll}
              className="text-xs border border-black/40 px-2 py-1 hover:border-black transition-colors"
            >
              Apply to all
            </button>
          </div>

          <span className="text-black/15">|</span>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Smiley:
            <button
              type="button"
              onClick={() => setAllSmileys(true)}
              className="border border-black/40 px-2 py-1 hover:border-black transition-colors"
            >
              All yes
            </button>
            <button
              type="button"
              onClick={() => setAllSmileys(false)}
              className="border border-black/40 px-2 py-1 hover:border-black transition-colors"
            >
              All no
            </button>
          </div>
        </div>

        <datalist id="claim-export-tools">
          {TOOL_OPTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        {/* Body */}
        <div className="px-5 py-4">
          {loading && <p className="text-xs text-muted-foreground py-6">Preparing claim links…</p>}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive py-6">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          {rows && !loading && !error && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[13%]">org_name</th>
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[11%]">contact_name</th>
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[15%]">email</th>
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[16%]">listing_name</th>
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[22%]">description</th>
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[13%]">current_tool</th>
                      <th className="py-2 pr-3 font-medium text-muted-foreground w-[5%]">smiley</th>
                      <th className="py-2 font-medium text-muted-foreground w-[5%]">claim_url</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const i = inputs[r.id];
                      if (!i) return null;
                      return (
                        <tr key={r.id} className="border-b border-border align-top">
                          <td className="py-2 pr-3">
                            <input
                              value={i.orgName}
                              onChange={(e) => update(r.id, { orgName: e.target.value })}
                              placeholder="Organisation"
                              className={cell}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              value={i.contactName}
                              onChange={(e) => update(r.id, { contactName: e.target.value })}
                              placeholder="Blank = general inbox"
                              className={cell}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              type="email"
                              value={i.email}
                              onChange={(e) => update(r.id, { email: e.target.value })}
                              placeholder="hello@organisation.nz"
                              className={`${cell} ${!i.email.trim() ? "border-amber-300" : ""}`}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              value={i.listingName}
                              onChange={(e) => update(r.id, { listingName: e.target.value })}
                              className={cell}
                            />
                            <a
                              href={r.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block mt-1 text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                            >
                              View listing ↗
                            </a>
                          </td>
                          <td className="py-2 pr-3">
                            <textarea
                              rows={3}
                              value={i.description}
                              onChange={(e) => update(r.id, { description: e.target.value })}
                              placeholder="No description on this listing"
                              className={`${cell} resize-y leading-relaxed`}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <input
                              list="claim-export-tools"
                              value={i.currentTool}
                              onChange={(e) => update(r.id, { currentTool: e.target.value })}
                              placeholder="Website form, Google Form…"
                              className={cell}
                            />
                          </td>
                          <td className="py-2 pr-3">
                            <label className="flex items-center gap-1.5 py-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={i.subjectSmiley}
                                onChange={(e) => update(r.id, { subjectSmiley: e.target.checked })}
                                className="cursor-pointer"
                              />
                              <span className="text-muted-foreground">:)</span>
                            </label>
                          </td>
                          <td className="py-2">
                            {r.alreadyOwned ? (
                              <span
                                title="This listing already has an owner — a claim link would be rejected, so none was generated."
                                className="flex items-center gap-1 text-[11px] text-amber-700 cursor-default"
                              >
                                <AlertCircle className="w-3 h-3 shrink-0" /> Owned
                              </span>
                            ) : (
                              <a
                                href={r.claimUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={r.claimUrl}
                                className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground break-all"
                              >
                                {r.tokenIsNew ? "New link ↗" : "Link ↗"}
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4 text-[11px] text-muted-foreground">
                {expiryDate && <span>Links work until {expiryDate}.</span>}
                {newTokens > 0 && (
                  <span>
                    {newTokens} new link{newTokens !== 1 ? "s" : ""} generated (any older link for
                    those listings no longer works).
                  </span>
                )}
                {ownedCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    {ownedCount} listing{ownedCount !== 1 ? "s" : ""} already owned — no claim link
                    generated, claim_url exports blank.
                  </span>
                )}
                {missingEmail > 0 && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    {missingEmail} row{missingEmail !== 1 ? "s" : ""} without an email — they&rsquo;ll
                    export blank.
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-black/20">
          <button
            type="button"
            onClick={onClose}
            className="text-xs border border-black/40 px-3 py-2 hover:border-black transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!rows || loading}
            onClick={exportCSV}
            className="text-xs bg-black text-white px-4 py-2 hover:bg-black/80 transition-colors disabled:opacity-50"
          >
            Export CSV ↓
          </button>
        </div>
      </div>
    </div>
  );
}
