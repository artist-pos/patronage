"use client";

import { useState, useTransition } from "react";
import { updateCampaignConfig, regenerateCampaignQr } from "@/app/studio/campaigns/actions";

const STATUS_OPTIONS = [
  "configuring", "awaiting_approval", "approved", "live", "paused", "completed", "archived",
] as const;

const PRODUCTION_STATUS_OPTIONS = [
  "pending", "files_submitted", "approved", "in_production", "live", "completed", "archived",
] as const;

interface Campaign {
  id: string;
  title: string;
  slug: string;
  campaign_type: string;
  status: string;
  production_status: string;
  partner_name: string | null;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  location_address: string | null;
  surface_type: string | null;
  production_specs: string | null;
  fee_amount: number | null;
  qr_code_url: string | null;
  landing_page_slug: string | null;
  landing_page_config: Record<string, unknown>;
}

interface CampaignFile {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  campaign: Campaign;
  files: CampaignFile[];
  landingUrl: string;
  artistId: string;
  username: string;
}

function fmtBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CampaignConfigPanel({ campaign, files, landingUrl, artistId, username }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState(campaign.qr_code_url);
  const [, startTransition] = useTransition();

  // Details form
  const [title, setTitle] = useState(campaign.title);
  const [partnerName, setPartnerName] = useState(campaign.partner_name ?? "");
  const [startDate, setStartDate] = useState(campaign.campaign_start_date ?? "");
  const [endDate, setEndDate] = useState(campaign.campaign_end_date ?? "");
  const [location, setLocation] = useState(campaign.location_address ?? "");
  const [specs, setSpecs] = useState(campaign.production_specs ?? "");
  const [status, setStatus] = useState(campaign.status);
  const [productionStatus, setProductionStatus] = useState(campaign.production_status);
  const [saving, setSaving] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    const result = await updateCampaignConfig(campaign.id, {
      title: title.trim() || campaign.title,
      partner_name: partnerName.trim() || null,
      campaign_start_date: startDate || null,
      campaign_end_date: endDate || null,
      location_address: location.trim() || null,
      production_specs: specs.trim() || null,
      status,
      production_status: productionStatus,
    });
    setSaving(false);
    if (result.error) {
      showToast(`Error: ${result.error}`);
    } else {
      showToast("Saved.");
    }
  }

  function handleRegenQr() {
    startTransition(async () => {
      const result = await regenerateCampaignQr(campaign.id);
      if (result.qrCodeUrl) {
        setQrUrl(result.qrCodeUrl);
        showToast("QR code regenerated.");
      } else {
        showToast(result.error ?? "Failed to regenerate QR.");
      }
    });
  }

  return (
    <div className="space-y-10">

      {/* QR code + landing URL */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400">QR Code</h2>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {qrUrl ? (
            <div className="space-y-2 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="Campaign QR code" className="w-32 h-32 border border-border" />
              <div className="flex gap-2">
                <a
                  href={qrUrl}
                  download={`${campaign.slug}-qr.png`}
                  className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                >
                  Download PNG
                </a>
                <button
                  type="button"
                  onClick={handleRegenQr}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Regenerate
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-32 h-32 border border-dashed border-border flex items-center justify-center">
                <span className="text-[11px] text-muted-foreground">No QR yet</span>
              </div>
              <button
                type="button"
                onClick={handleRegenQr}
                className="text-[11px] border border-black px-3 py-1.5 hover:bg-muted transition-colors"
              >
                Generate QR
              </button>
            </div>
          )}
          <div className="space-y-1.5 min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Landing URL</p>
            <p className="text-xs font-mono break-all">{landingUrl}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              This URL is embedded in your QR code. Share it on signage, packaging, or printed materials.
              Visitors are taken to your artist profile with your selected works highlighted.
            </p>
          </div>
        </div>
      </section>

      {/* Campaign details */}
      <section className="space-y-5 border-t border-border pt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400">Campaign Details</h2>

        <div className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
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
            <label className="text-xs font-medium">Production specs / notes</label>
            <textarea
              value={specs}
              onChange={e => setSpecs(e.target.value)}
              rows={3}
              placeholder="Print sizes, file format requirements, substrate, etc."
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Campaign status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black bg-background"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Production status</label>
              <select
                value={productionStatus}
                onChange={e => setProductionStatus(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black bg-background"
              >
                {PRODUCTION_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      {/* Production files */}
      <section className="space-y-4 border-t border-border pt-8">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-stone-400">Production Files</h2>
          <p className="text-[11px] text-muted-foreground">
            Upload final print-ready files. Max 10 MB per file. For files larger than 10 MB, send directly to your partner contact via email.
          </p>
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-sm font-medium truncate">{f.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {f.file_type?.replace("_", " ") ?? "file"}
                    {f.file_size_bytes ? ` · ${fmtBytes(f.file_size_bytes)}` : ""}
                    {f.notes ? ` — ${f.notes}` : ""}
                  </p>
                </div>
                <a
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground shrink-0"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Need to send large files? Email your production files directly to your partner contact,
          referencing campaign: <span className="font-mono">{campaign.slug}</span>
        </p>
      </section>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white text-sm px-5 py-2.5 z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
