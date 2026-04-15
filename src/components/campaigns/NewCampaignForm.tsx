"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSelfManagedCampaign } from "@/app/studio/campaigns/actions";

const CAMPAIGN_TYPES = [
  { value: "art_fair",      label: "Art Fair", description: "Booth signage and catalogue labels for fairs and markets." },
  { value: "exhibition",    label: "Exhibition", description: "Gallery or institutional exhibition — solo or group show." },
  { value: "hoarding",      label: "Hoarding", description: "Construction hoarding or temporary public installation." },
  { value: "billboard",     label: "Billboard", description: "Outdoor advertising — billboard or large-format poster." },
  { value: "truck_curtain", label: "Truck curtain", description: "Side-curtain vehicle wrap or transport activation." },
  { value: "packaging",     label: "Packaging", description: "Product packaging, merchandise, or print edition." },
  { value: "other",         label: "Other", description: "Any other campaign type." },
] as const;

type CampaignTypeValue = typeof CAMPAIGN_TYPES[number]["value"];

interface Work {
  id: string;
  url: string;
  caption: string | null;
  title: string | null;
}

interface Props {
  works: Work[];
  username: string;
}

function WorkThumb({ work, selected, onToggle }: { work: Work; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative border-2 transition-colors text-left ${
        selected ? "border-black" : "border-transparent hover:border-border"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={work.url}
        alt={work.caption ?? work.title ?? ""}
        className="w-full aspect-square object-cover"
      />
      {selected && (
        <div className="absolute top-1 right-1 w-5 h-5 bg-black flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">✓</span>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">
        {work.caption ?? work.title ?? "Untitled"}
      </p>
    </button>
  );
}

export function NewCampaignForm({ works, username }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [step, setStep] = useState<"type" | "details" | "works">("type");
  const [campaignType, setCampaignType] = useState<CampaignTypeValue | null>(null);
  const [title, setTitle] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [specs, setSpecs] = useState("");
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleWork(id: string) {
    setSelectedWorkIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedType = CAMPAIGN_TYPES.find(t => t.value === campaignType);

  async function handleCreate() {
    if (!campaignType || !title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createSelfManagedCampaign({
      title: title.trim(),
      campaign_type: campaignType,
      partner_name: partnerName.trim() || undefined,
      campaign_start_date: startDate || undefined,
      campaign_end_date: endDate || undefined,
      location_address: location.trim() || undefined,
      production_specs: specs.trim() || undefined,
    });
    setCreating(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.campaignId) {
      router.push(`/studio/campaigns/${result.campaignId}`);
    }
  }

  async function handleDownloadPdf() {
    if (!campaignType || !title.trim()) return;

    // Lazy-load jspdf for the art fair PDF export
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(title.trim(), margin, margin + 8);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    const headerLines: string[] = [
      selectedType?.label ?? campaignType ?? "",
      partnerName ? `Partner: ${partnerName}` : "",
      startDate && endDate ? `${startDate} – ${endDate}` : startDate || endDate || "",
      location || "",
      `patronage.nz/${username}`,
    ].filter(Boolean);
    doc.text(headerLines.join("   ·   "), margin, margin + 16);
    doc.setTextColor(0, 0, 0);

    let y = margin + 28;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    // One label block per selected work (or a generic block if no works selected)
    const worksToLabel = works.filter(w => selectedWorkIds.has(w.id));
    if (worksToLabel.length === 0) {
      // Generic collection QR label
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("View the full collection", margin, y + 6);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`patronage.nz/${username}`, margin, y + 12);
      doc.setTextColor(0, 0, 0);

      // QR placeholder box
      doc.setDrawColor(180, 180, 180);
      doc.rect(pageW - margin - 40, y, 40, 40);
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text("QR code", pageW - margin - 40 + 8, y + 22);
      doc.setTextColor(0, 0, 0);
    } else {
      const labelH = 55;
      for (const work of worksToLabel) {
        if (y + labelH > pageH - margin) {
          doc.addPage();
          y = margin;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(work.caption ?? work.title ?? "Untitled", margin, y + 6, { maxWidth: contentW - 50 });

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`${username} · patronage.nz`, margin, y + 13);
        doc.setTextColor(0, 0, 0);

        // QR placeholder box
        doc.setDrawColor(180, 180, 180);
        doc.rect(pageW - margin - 40, y, 40, 40);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text("QR code", pageW - margin - 40 + 8, y + 22);
        doc.setTextColor(0, 0, 0);

        doc.setDrawColor(230, 230, 230);
        doc.line(margin, y + labelH - 4, pageW - margin, y + labelH - 4);
        y += labelH;
      }

      // Append a collection label at the end
      if (y + 50 > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Explore all works", margin, y + 6);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`patronage.nz/${username}`, margin, y + 12);
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(180, 180, 180);
      doc.rect(pageW - margin - 40, y, 40, 40);
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text("QR code", pageW - margin - 40 + 8, y + 22);
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`${title.trim().toLowerCase().replace(/\s+/g, "-")}-labels.pdf`);
  }

  // ── Step: Type ───────────────────────────────────────────────────────────────
  if (step === "type") {
    return (
      <div className="space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Select campaign type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAMPAIGN_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setCampaignType(t.value); setStep("details"); }}
              className="text-left border border-border p-4 space-y-1 hover:border-black transition-colors"
            >
              <p className="text-sm font-medium">{t.label}</p>
              <p className="text-[11px] text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step: Details ────────────────────────────────────────────────────────────
  if (step === "details") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep("type")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm font-medium">{selectedType?.label}</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Campaign title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`e.g. ${selectedType?.label === "Art Fair" ? "Wellington Art Fair 2025" : selectedType?.label === "Exhibition" ? "Solo exhibition — City Gallery" : "Campaign name"}`}
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Partner / Organisation</label>
            <input
              type="text"
              value={partnerName}
              onChange={e => setPartnerName(e.target.value)}
              placeholder="Leave blank if self-managed"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">End date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Location / Venue</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Address or venue name"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Notes</label>
            <textarea
              value={specs}
              onChange={e => setSpecs(e.target.value)}
              rows={2}
              placeholder="Print specs, context, or anything else useful"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep("works")}
            disabled={!title.trim()}
            className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Select works →
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            className="text-sm border border-border px-4 py-2 hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground"
          >
            {creating ? "Creating…" : "Skip — create campaign"}
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  // ── Step: Works ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep("details")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <span className="text-sm text-muted-foreground">·</span>
        <span className="text-sm font-medium">{title}</span>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Select works to feature</p>
        <p className="text-[11px] text-muted-foreground">
          Selected works get individual QR labels in your art fair PDF. A collection QR is always included.
        </p>
      </div>

      {works.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No portfolio works yet.{" "}
          <a href="/studio" className="underline underline-offset-2">Add works in Studio →</a>
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {works.map(w => (
            <WorkThumb
              key={w.id}
              work={w}
              selected={selectedWorkIds.has(w.id)}
              onToggle={() => toggleWork(w.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create campaign →"}
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!title.trim()}
          className="text-sm border border-border px-4 py-2 hover:bg-muted transition-colors disabled:opacity-40 text-muted-foreground"
        >
          Download label PDF
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
