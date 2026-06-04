"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  updateCampaignConfig,
  regenerateCampaignQr,
  recordCampaignFile,
  deleteCampaignFile,
  publishStorefront,
  submitForApproval,
  setCampaignPublic,
} from "@/app/studio/campaigns/actions";
import { NewArtworkEditor } from "@/components/dashboard/NewArtworkEditor";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PrintSize {
  size: string;
  price: string;
}

interface WorkPricing {
  available?: boolean;
  price?: number | null;
  is_poa?: boolean;
  acquisition_mode?: "buy_now" | "enquire_first";
  prints_available?: boolean;
  print_sizes?: PrintSize[];
}

interface ShippingConfig {
  nz_cents?: number;
  intl_cents?: number;
  stripe_nz_rate_id?: string;
  stripe_intl_rate_id?: string;
}

interface StorefrontConfig extends Record<string, unknown> {
  hero_work_id?: string;
  selected_work_ids?: string[];
  layout_mode?: "shopfront" | "showcase";
  work_pricing?: Record<string, WorkPricing>;
  original_available?: boolean;
  original_price?: number | null;
  is_poa?: boolean;
  prints_available?: boolean;
  print_sizes?: PrintSize[];
  edition_size?: string;
  paper_stock?: string;
  artist_statement?: string;
  shipping?: ShippingConfig;
}

interface Work {
  id: string;
  url: string | null;
  caption: string | null;
  title: string | null;
  content_type?: string;
}

interface Campaign {
  id: string;
  title: string;
  slug: string;
  campaign_type: string;
  status: string;
  production_status: string;
  is_public: boolean;
  partner_name: string | null;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  location_address: string | null;
  venue_contact_name: string | null;
  venue_contact_email: string | null;
  venue_contact_phone: string | null;
  surface_type: string | null;
  production_specs: string | null;
  fee_amount: number | null;
  qr_code_url: string | null;
  landing_page_slug: string | null;
  landing_page_config: Record<string, unknown>;
  opportunity_id: string | null;
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
  works: Work[];
  profileId: string;
  bio: string | null;
  featuredImageUrl: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function slugifyTitle(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const PRODUCTION_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting files",
  files_submitted: "Files submitted",
  approved: "Approved",
  in_production: "In production",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

// ── Subcomponents ──────────────────────────────────────────────────────────────

function WorkCard({
  work,
  isHero,
  isSelected,
  onSelectHero,
  onToggle,
}: {
  work: Work;
  isHero: boolean;
  isSelected: boolean;
  onSelectHero: () => void;
  onToggle: () => void;
}) {
  const label = work.caption ?? work.title ?? "Untitled";
  const isImage = !work.content_type || work.content_type === "image";

  return (
    <div className={`relative border-2 transition-colors ${isHero ? "border-black" : isSelected ? "border-black/50" : "border-transparent hover:border-border"}`}>
      {isImage && work.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={work.url} alt={label} className="w-full aspect-square object-cover" />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground uppercase">{work.content_type ?? "work"}</span>
        </div>
      )}

      {isHero && (
        <div className="absolute top-1 left-1 bg-black text-white text-[9px] font-bold px-1.5 py-0.5 leading-none">
          HERO
        </div>
      )}
      {isSelected && !isHero && (
        <div className="absolute top-1 right-1 w-4 h-4 bg-black flex items-center justify-center">
          <span className="text-white text-[9px] font-bold">✓</span>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">{label}</p>

      <div className="flex gap-1 px-1 pb-1">
        <button
          type="button"
          onClick={onSelectHero}
          className={`text-[9px] px-1.5 py-0.5 border transition-colors flex-1 ${isHero ? "border-black bg-black text-white" : "border-border hover:border-black"}`}
        >
          {isHero ? "Hero" : "Set hero"}
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={isHero}
          className={`text-[9px] px-1.5 py-0.5 border transition-colors flex-1 disabled:opacity-30 ${isSelected && !isHero ? "border-black" : "border-border hover:border-black"}`}
        >
          {isSelected && !isHero ? "Selected" : "Select"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CampaignConfigPanel({
  campaign,
  files: initialFiles,
  landingUrl,
  artistId,
  username,
  works,
  profileId,
  bio,
  featuredImageUrl,
}: Props) {
  void artistId;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState(campaign.qr_code_url);
  const [files, setFiles] = useState(initialFiles);

  const isPartnerCampaign = !!campaign.opportunity_id;

  // Initialise storefront config from landing_page_config
  const cfg = campaign.landing_page_config as StorefrontConfig;

  // Campaign details
  const [title, setTitle] = useState(campaign.title);
  const [startDate, setStartDate] = useState(campaign.campaign_start_date ?? "");
  const [endDate, setEndDate] = useState(campaign.campaign_end_date ?? "");
  const [location, setLocation] = useState(campaign.location_address ?? "");
  const [venueContactName, setVenueContactName] = useState(campaign.venue_contact_name ?? "");
  const [venueContactEmail, setVenueContactEmail] = useState(campaign.venue_contact_email ?? "");
  const [venueContactPhone, setVenueContactPhone] = useState(campaign.venue_contact_phone ?? "");
  const [saving, setSaving] = useState(false);

  // Storefront builder state
  const [heroWorkId, setHeroWorkId] = useState<string | undefined>(cfg.hero_work_id);
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(
    new Set(cfg.selected_work_ids ?? [])
  );

  const [artistStatement, setArtistStatement] = useState(cfg.artist_statement ?? bio ?? "");

  // Shipping rates (NZD dollars, converted to cents when saving)
  const existingShipping = cfg.shipping as ShippingConfig | undefined;
  const [shippingNzDollars, setShippingNzDollars] = useState(existingShipping?.nz_cents ? String(existingShipping.nz_cents / 100) : "");
  const [shippingIntlDollars, setShippingIntlDollars] = useState(existingShipping?.intl_cents ? String(existingShipping.intl_cents / 100) : "");

  // Layout mode
  const [layoutMode, setLayoutMode] = useState<"shopfront" | "showcase">(cfg.layout_mode ?? "shopfront");

  // Per-work pricing
  type WP = { available: boolean; price: string; is_poa: boolean; acquisition_mode: "buy_now" | "enquire_first"; prints_available: boolean; print_sizes: PrintSize[] };
  const [workPricing, setWorkPricing] = useState<Record<string, WP>>(() => {
    const result: Record<string, WP> = {};
    if (cfg.work_pricing) {
      for (const [id, wp] of Object.entries(cfg.work_pricing)) {
        result[id] = {
          available: wp.available ?? true,
          price: wp.price != null ? String(wp.price) : "",
          is_poa: wp.is_poa ?? false,
          acquisition_mode: (wp.acquisition_mode as "buy_now" | "enquire_first") ?? "enquire_first",
          prints_available: wp.prints_available ?? false,
          print_sizes: (wp.print_sizes && wp.print_sizes.length > 0) ? wp.print_sizes : [{ size: "", price: "" }],
        };
      }
    }
    return result;
  });

  const defaultWP = (): WP => ({ available: false, price: "", is_poa: false, acquisition_mode: "enquire_first", prints_available: false, print_sizes: [{ size: "", price: "" }] });

  function setWorkField(workId: string, field: keyof WP, value: boolean | string | PrintSize[]) {
    setWorkPricing(prev => ({
      ...prev,
      [workId]: { ...(prev[workId] ?? defaultWP()), [field]: value },
    }));
  }

  function addWorkPrintRow(workId: string) {
    setWorkPricing(prev => {
      const wp = prev[workId] ?? defaultWP();
      return { ...prev, [workId]: { ...wp, print_sizes: [...wp.print_sizes, { size: "", price: "" }] } };
    });
  }

  function removeWorkPrintRow(workId: string, i: number) {
    setWorkPricing(prev => {
      const wp = prev[workId] ?? defaultWP();
      return { ...prev, [workId]: { ...wp, print_sizes: wp.print_sizes.filter((_, idx) => idx !== i) } };
    });
  }

  function updateWorkPrintRow(workId: string, i: number, field: "size" | "price", value: string) {
    setWorkPricing(prev => {
      const wp = prev[workId] ?? defaultWP();
      return { ...prev, [workId]: { ...wp, print_sizes: wp.print_sizes.map((row, idx) => idx === i ? { ...row, [field]: value } : row) } };
    });
  }

  // Hero picker
  const [showHeroPicker, setShowHeroPicker] = useState(!heroWorkId);

  // Work upload inline
  const [showUploadWork, setShowUploadWork] = useState(false);

  // Production file upload
  const [uploading, setUploading] = useState(false);
  const [fileNote, setFileNote] = useState("");

  // Publishing
  const [publishing, setPublishing] = useState(false);
  const [isPublic, setIsPublic] = useState(campaign.is_public);
  const [togglingPublic, setTogglingPublic] = useState(false);

  const supabase = createClient();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function toggleWorkSelected(workId: string) {
    if (workId === heroWorkId) return; // hero is always included
    const selectedList = [...selectedWorkIds];
    if (selectedList.length >= 6 && !selectedWorkIds.has(workId)) {
      showToast("Maximum 6 works. Remove one to add another.");
      return;
    }
    setSelectedWorkIds(prev => {
      const next = new Set(prev);
      if (next.has(workId)) next.delete(workId);
      else next.add(workId);
      return next;
    });
  }

  function setHero(workId: string) {
    setHeroWorkId(workId);
    // Hero is always selected
    setSelectedWorkIds(prev => new Set([...prev, workId]));
  }

  function buildConfig(): StorefrontConfig {
    const nzCents = shippingNzDollars ? Math.round(parseFloat(shippingNzDollars) * 100) : undefined;
    const intlCents = shippingIntlDollars ? Math.round(parseFloat(shippingIntlDollars) * 100) : undefined;
    const shippingConfig: ShippingConfig | undefined = (nzCents || intlCents)
      ? {
          ...(nzCents ? { nz_cents: nzCents } : {}),
          ...(intlCents ? { intl_cents: intlCents } : {}),
          // Preserve cached Stripe rate IDs so they aren't wiped on save
          ...(existingShipping?.stripe_nz_rate_id ? { stripe_nz_rate_id: existingShipping.stripe_nz_rate_id } : {}),
          ...(existingShipping?.stripe_intl_rate_id ? { stripe_intl_rate_id: existingShipping.stripe_intl_rate_id } : {}),
        }
      : undefined;
    return {
      hero_work_id: heroWorkId,
      selected_work_ids: [...selectedWorkIds],
      artist_statement: artistStatement.trim() || undefined,
      layout_mode: layoutMode,
      ...(shippingConfig ? { shipping: shippingConfig } : {}),
      work_pricing: Object.fromEntries(
        [...selectedWorkIds]
          .filter(id => workPricing[id])
          .map(id => {
            const wp = workPricing[id];
            return [id, {
              available: wp.available,
              price: wp.is_poa ? null : (wp.price ? parseFloat(wp.price) : null),
              is_poa: wp.is_poa,
              acquisition_mode: wp.acquisition_mode,
              prints_available: wp.prints_available,
              print_sizes: wp.prints_available ? wp.print_sizes.filter(r => r.size.trim()) : [],
            }];
          })
      ),
    };
  }

  async function handleSaveDetails() {
    setSaving(true);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const result = await updateCampaignConfig(campaign.id, {
      title: title.trim() || campaign.title,
      campaign_start_date: startDate || null,
      campaign_end_date: endDate || null,
      location_address: location.trim() || null,
      venue_contact_name: venueContactName.trim() || null,
      venue_contact_email: venueContactEmail.trim() || null,
      venue_contact_phone: venueContactPhone.trim() || null,
      landing_page_config: buildConfig(),
      hero_work_id: heroWorkId && UUID_RE.test(heroWorkId) ? heroWorkId : null,
    });
    setSaving(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else showToast("Saved.");
  }

  function handleRegenQr() {
    startTransition(async () => {
      const result = await regenerateCampaignQr(campaign.id);
      if (result.qrCodeUrl) { setQrUrl(result.qrCodeUrl); showToast("QR regenerated."); }
      else showToast(result.error ?? "Failed to regenerate QR.");
    });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast("File too large. Max 10 MB. Email large files to hello@patronage.nz");
      e.target.value = "";
      return;
    }
    setUploading(true);
    const path = `${campaign.id}/${Date.now()}-${file.name.replace(/[^a-z0-9._-]/gi, "_")}`;
    const { error: uploadErr } = await supabase.storage
      .from("campaign-files")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadErr) {
      showToast(`Upload failed: ${uploadErr.message}`);
      setUploading(false);
      e.target.value = "";
      return;
    }
    const { data: urlData } = supabase.storage.from("campaign-files").getPublicUrl(path);
    const result = await recordCampaignFile(
      campaign.id, urlData.publicUrl, file.name, "production_final", file.size
    );
    setUploading(false);
    e.target.value = "";
    if (result.error) { showToast(`Error: ${result.error}`); return; }
    setFiles(prev => [{
      id: Date.now().toString(),
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_type: "production_final",
      file_size_bytes: file.size,
      notes: fileNote || null,
      created_at: new Date().toISOString(),
    }, ...prev]);
    setFileNote("");
    showToast("File uploaded.");
  }

  async function handleDeleteFile(fileId: string) {
    const result = await deleteCampaignFile(fileId, campaign.id);
    if (result.error) { showToast(`Error: ${result.error}`); return; }
    setFiles(prev => prev.filter(f => f.id !== fileId));
    showToast("File removed.");
  }

  async function handleDownloadZip() {
    const { default: JSZip } = await import("jszip");
    const { saveAs } = await import("file-saver");
    const QRCode = await import("qrcode");

    const zip = new JSZip();
    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

    // Collection QR — fetch existing PNG from storage
    if (qrUrl) {
      try {
        const res = await fetch(qrUrl);
        const blob = await res.blob();
        zip.file("collection-qr.png", blob);
      } catch {
        // fallback: regenerate client-side
        const buf = await QRCode.toBuffer(landingUrl, { type: "png", width: 512, margin: 2, errorCorrectionLevel: "H" } as Parameters<typeof QRCode.toBuffer>[1]);
        zip.file("collection-qr.png", buf);
      }
    } else {
      const dataUrl = await QRCode.toDataURL(landingUrl, { width: 512, margin: 2, errorCorrectionLevel: "H" });
      const b64 = dataUrl.split(",")[1];
      zip.file("collection-qr.png", b64, { base64: true });
    }

    // Per-work QRs
    const csvRows: string[] = ["filename,work_title,qr_url"];
    const selectedWorks = works.filter(w => selectedWorkIds.has(w.id));
    for (const work of selectedWorks) {
      const workUrl = `${SITE_URL}/live/${campaign.slug}/${username}?work=${work.id}`;
      const label = work.caption ?? work.title ?? "untitled";
      const filename = `${slugifyTitle(label)}-qr.png`;
      const dataUrl = await QRCode.toDataURL(workUrl, { width: 512, margin: 2, errorCorrectionLevel: "H" });
      const b64 = dataUrl.split(",")[1];
      zip.file(filename, b64, { base64: true });
      csvRows.push(`${filename},"${label.replace(/"/g, '""')}",${workUrl}`);
    }
    csvRows.push(`collection-qr.png,"Collection",${landingUrl}`);
    zip.file("labels.csv", csvRows.join("\n"));

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${campaign.slug}-qr-assets.zip`);
  }

  async function handleTogglePublic() {
    setTogglingPublic(true);
    const next = !isPublic;
    const result = await setCampaignPublic(campaign.id, next);
    setTogglingPublic(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else {
      setIsPublic(next);
      showToast(next ? "Campaign visible on your profile." : "Campaign hidden from your profile.");
      router.refresh();
    }
  }

  async function handlePublish() {
    if (!heroWorkId) { showToast("Select a hero artwork first."); return; }
    setPublishing(true);
    // Save config first
    await updateCampaignConfig(campaign.id, { landing_page_config: buildConfig() });
    const result = isPartnerCampaign
      ? await submitForApproval(campaign.id)
      : await publishStorefront(campaign.id);
    setPublishing(false);
    if (result.error) showToast(`Error: ${result.error}`);
    else {
      showToast(isPartnerCampaign ? "Submitted for approval." : "Storefront is live!");
      router.refresh();
    }
  }

  const canPublish = !!heroWorkId && (!isPartnerCampaign || files.length > 0);
  const isLive = campaign.status === "live";
  const isSubmitted = campaign.status === "awaiting_approval";

  return (
    <div className="space-y-12">

      {/* ── Top: QR + preview ────────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row gap-6 items-start">
        {/* QR code */}
        <div className="space-y-3 shrink-0">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Campaign QR code" className="w-36 h-36 border border-black" />
          ) : (
            <div className="w-36 h-36 border border-dashed border-border flex items-center justify-center">
              <span className="text-[11px] text-muted-foreground">No QR yet</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={!qrUrl}
              className="text-[11px] border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-40"
            >
              Download QR assets (.zip)
            </button>
            <button
              type="button"
              onClick={handleRegenQr}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>

        {/* Landing URL + preview */}
        <div className="space-y-3 min-w-0 flex-1">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest mb-1">Storefront URL</p>
            <p className="text-xs font-mono break-all">{landingUrl}</p>
          </div>
          <a
            href={landingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm border border-black px-4 py-2 hover:bg-muted transition-colors"
          >
            Preview storefront ↗
          </a>
          {isLive && (
            <div className="flex items-center gap-3">
              <span className={`inline-block text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide ${isPublic ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                {isPublic ? "Live" : "Delisted"}
              </span>
              <button
                type="button"
                onClick={handleTogglePublic}
                disabled={togglingPublic}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                {togglingPublic ? "Saving…" : isPublic ? "Delist from profile" : "Re-publish to profile"}
              </button>
            </div>
          )}
          {isSubmitted && (
            <span className="inline-block text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 font-medium uppercase tracking-wide">
              Awaiting approval
            </span>
          )}
        </div>
      </section>

      {/* ── Campaign info ────────────────────────────────────────────────── */}
      <section className="space-y-5 border-t border-border pt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Campaign Info</h2>
        <div className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Title</label>
            {isPartnerCampaign ? (
              <p className="text-sm">{title}</p>
            ) : (
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Start date</label>
              {isPartnerCampaign ? (
                <p className="text-sm">{startDate || "—"}</p>
              ) : (
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">End date</label>
              {isPartnerCampaign ? (
                <p className="text-sm">{endDate || "—"}</p>
              ) : (
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
              )}
            </div>
          </div>

          {!isPartnerCampaign && (
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
          )}

          {!isPartnerCampaign && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Venue contact</label>
                <p className="text-[11px] text-muted-foreground">For café or venue displays — enquiries are sent to this person as well as you.</p>
              </div>
              <input
                type="text"
                value={venueContactName}
                onChange={e => setVenueContactName(e.target.value)}
                placeholder="Contact name"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
              />
              <input
                type="email"
                value={venueContactEmail}
                onChange={e => setVenueContactEmail(e.target.value)}
                placeholder="Contact email"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
              />
              <input
                type="tel"
                value={venueContactPhone}
                onChange={e => setVenueContactPhone(e.target.value)}
                placeholder="Contact phone (optional)"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
              />
            </div>
          )}

          {!isPartnerCampaign && (
            <button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving}
              className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save details"}
            </button>
          )}
        </div>
      </section>

      {/* ── Layout mode ─────────────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-border pt-8">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Layout</h2>
          <p className="text-[11px] text-muted-foreground">
            How your storefront looks when visitors scan the campaign QR.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setLayoutMode("shopfront")}
            className={`text-left border p-4 space-y-2 transition-colors ${layoutMode === "shopfront" ? "border-black" : "border-border hover:border-stone-300"}`}
          >
            <div className="flex flex-col gap-0.5">
              <div className="w-full h-1.5 bg-current opacity-20 rounded-sm" />
              <div className="grid grid-cols-3 gap-0.5 mt-1">
                {[0,1,2,3,4,5].map(i => <div key={i} className="h-6 bg-current opacity-10 rounded-sm" />)}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium">Shopfront</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Grid of all works. Good for art fairs and markets.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode("showcase")}
            className={`text-left border p-4 space-y-2 transition-colors ${layoutMode === "showcase" ? "border-black" : "border-border hover:border-stone-300"}`}
          >
            <div className="flex flex-col gap-0.5">
              <div className="w-full h-8 bg-current opacity-10 rounded-sm" />
              <div className="grid grid-cols-3 gap-0.5 mt-1">
                {[0,1,2].map(i => <div key={i} className="h-3 bg-current opacity-10 rounded-sm" />)}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium">Showcase</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Hero work prominent, others below. Good for exhibitions and hoardings.</p>
            </div>
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Each individual work also gets its own QR — when scanned, it always spotlights that specific work.
        </p>
      </section>

      {/* ── Storefront builder: hero ─────────────────────────────────────── */}
      <section className="space-y-5 border-t border-border pt-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Hero Artwork</h2>
            <p className="text-[11px] text-muted-foreground">
              The featured work on your storefront. Required to publish.
            </p>
          </div>
          {heroWorkId && !showHeroPicker && (
            <button
              type="button"
              onClick={() => setShowHeroPicker(true)}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Change
            </button>
          )}
        </div>

        {/* Selected hero preview */}
        {heroWorkId && !showHeroPicker && (() => {
          const isProfileFeatured = heroWorkId === "profile_featured";
          const hero = isProfileFeatured ? null : works.find(w => w.id === heroWorkId);
          const heroUrl = isProfileFeatured ? featuredImageUrl : hero?.url;
          const heroLabel = isProfileFeatured ? "Profile featured image" : (hero?.caption ?? hero?.title ?? "Untitled");
          return (
            <div className="flex items-center gap-4 p-3 border border-black">
              {heroUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroUrl} alt="" className="w-20 h-20 object-cover shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{heroLabel}</p>
                {isProfileFeatured && (
                  <p className="text-[11px] text-muted-foreground">From your profile settings</p>
                )}
              </div>
            </div>
          );
        })()}

        {/* Inline hero picker */}
        {(!heroWorkId || showHeroPicker) && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Select the main image for your storefront:</p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {/* Profile featured image option */}
              {featuredImageUrl && (
                <button
                  type="button"
                  onClick={() => { setHeroWorkId("profile_featured"); setShowHeroPicker(false); }}
                  className="relative border-2 border-transparent hover:border-black transition-colors text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={featuredImageUrl} alt="Profile featured" className="w-full aspect-square object-cover" />
                  <div className="absolute top-1 left-1 bg-stone-700 text-white text-[8px] font-bold px-1 py-0.5 leading-none">
                    PROFILE
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">Profile image</p>
                </button>
              )}

              {/* Upload new work */}
              {!showUploadWork && (
                <button
                  type="button"
                  onClick={() => setShowUploadWork(true)}
                  className="border-2 border-dashed border-border hover:border-black transition-colors aspect-square flex flex-col items-center justify-center gap-1"
                >
                  <span className="text-xl text-muted-foreground">+</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight px-1">
                    Upload<br />new work
                  </span>
                </button>
              )}

              {/* Portfolio works */}
              {works.map(work => {
                const isImage = !work.content_type || work.content_type === "image";
                const label = work.caption ?? work.title ?? "Untitled";
                return (
                  <button
                    key={work.id}
                    type="button"
                    onClick={() => { setHeroWorkId(work.id); setSelectedWorkIds(prev => new Set([...prev, work.id])); setShowHeroPicker(false); }}
                    className="relative border-2 border-transparent hover:border-black transition-colors text-left"
                  >
                    {isImage && work.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={work.url} alt={label} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-muted flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground uppercase">{work.content_type ?? "work"}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground truncate px-1 py-0.5">{label}</p>
                  </button>
                );
              })}
            </div>

            {/* Inline upload form */}
            {showUploadWork && (
              <div className="border border-border p-4 mt-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-medium">Upload new work</p>
                  <button type="button" onClick={() => setShowUploadWork(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
                <NewArtworkEditor
                  profileId={profileId}
                  onCancel={() => setShowUploadWork(false)}
                  onSaved={() => { setShowUploadWork(false); router.refresh(); }}
                />
              </div>
            )}

            {heroWorkId && showHeroPicker && (
              <button
                type="button"
                onClick={() => setShowHeroPicker(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Storefront builder: works grid ──────────────────────────────── */}
      <section className="space-y-5 border-t border-border pt-8">
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Works</h2>
            <p className="text-[11px] text-muted-foreground">
              {selectedWorkIds.size} selected · max 6 · each gets its own QR label
            </p>
          </div>
          <button
            type="button"
            onClick={handleSaveDetails}
            disabled={saving}
            className="text-[11px] border border-black px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? "Saving…" : "Save selection"}
          </button>
        </div>

        {/* Inline upload */}
        {showUploadWork ? (
          <div className="border border-border p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium">Upload new work</p>
              <button
                type="button"
                onClick={() => setShowUploadWork(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <NewArtworkEditor
              profileId={profileId}
              onCancel={() => setShowUploadWork(false)}
              onSaved={() => { setShowUploadWork(false); router.refresh(); }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {/* Upload card */}
            <button
              type="button"
              onClick={() => setShowUploadWork(true)}
              className="border-2 border-dashed border-border hover:border-black transition-colors aspect-square flex flex-col items-center justify-center gap-1"
            >
              <span className="text-xl text-muted-foreground">+</span>
              <span className="text-[10px] text-muted-foreground text-center leading-tight px-1">
                Upload<br />new work
              </span>
            </button>

            {/* Work cards */}
            {works.map(work => (
              <WorkCard
                key={work.id}
                work={work}
                isHero={work.id === heroWorkId}
                isSelected={selectedWorkIds.has(work.id)}
                onSelectHero={() => setHero(work.id)}
                onToggle={() => toggleWorkSelected(work.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Per-work pricing ────────────────────────────────────────────── */}
      {selectedWorkIds.size > 0 && (
        <section className="space-y-4 border-t border-border pt-8">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Artwork Pricing</h2>
            <p className="text-[11px] text-muted-foreground">
              Set a price for each work. Visitors see this when they tap a work on your storefront.
            </p>
          </div>
          <div className="space-y-3">
            {[...selectedWorkIds].map(workId => {
              const work = works.find(w => w.id === workId);
              if (!work) return null;
              const isImage = !work.content_type || work.content_type === "image";
              const label = work.caption ?? work.title ?? "Untitled";
              const wp = workPricing[workId] ?? defaultWP();
              return (
                <div key={workId} className="border border-border p-3 space-y-3">
                  {/* Work header + for-sale toggle */}
                  <div className="flex items-center gap-3">
                    {isImage && work.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={work.url} alt={label} className="w-10 h-10 object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-muted shrink-0 flex items-center justify-center">
                        <span className="text-[9px] text-muted-foreground uppercase">{work.content_type ?? "work"}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{label}</p>
                      {workId === heroWorkId && <p className="text-[10px] text-muted-foreground">Hero</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setWorkField(workId, "available", !wp.available)}
                      className={`text-[10px] px-2.5 py-1 border transition-colors shrink-0 ${wp.available ? "border-black bg-black text-white" : "border-border text-muted-foreground hover:border-black"}`}
                    >
                      {wp.available ? "For sale" : "Not for sale"}
                    </button>
                  </div>

                  {wp.available && (
                    <div className="pl-[52px] space-y-4">
                      {/* Original */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Original</p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setWorkField(workId, "is_poa", !wp.is_poa)}
                            className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${wp.is_poa ? "bg-black" : "bg-stone-200"}`}
                            role="switch" aria-checked={wp.is_poa}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${wp.is_poa ? "left-[18px]" : "left-0.5"}`} />
                          </button>
                          <span className="text-xs">Price on application (POA)</span>
                        </div>
                        {!wp.is_poa && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">$</span>
                            <input
                              type="number" min="0" step="any"
                              value={wp.price}
                              onChange={e => setWorkField(workId, "price", e.target.value)}
                              placeholder="Price (NZD)"
                              className="w-36 border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
                            />
                          </div>
                        )}
                        {!wp.is_poa && (
                          <div className="flex items-center gap-1 mt-1">
                            {(["enquire_first", "buy_now"] as const).map(mode => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setWorkField(workId, "acquisition_mode", mode)}
                                className={`text-[10px] px-2.5 py-1 border transition-colors ${wp.acquisition_mode === mode ? "border-black bg-black text-white" : "border-border text-muted-foreground hover:border-black"}`}
                              >
                                {mode === "enquire_first" ? "Enquire first" : "Buy now"}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Prints */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setWorkField(workId, "prints_available", !wp.prints_available)}
                            className={`w-8 h-4 rounded-full transition-colors relative shrink-0 ${wp.prints_available ? "bg-black" : "bg-stone-200"}`}
                            role="switch" aria-checked={wp.prints_available}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${wp.prints_available ? "left-[18px]" : "left-0.5"}`} />
                          </button>
                          <span className="text-xs font-medium">Prints available</span>
                        </div>
                        {wp.prints_available && (
                          <div className="space-y-1.5 pl-11">
                            {wp.print_sizes.map((row, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="text" value={row.size}
                                  onChange={e => updateWorkPrintRow(workId, i, "size", e.target.value)}
                                  placeholder="e.g. A3"
                                  className="flex-1 border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
                                />
                                <input
                                  type="text" value={row.price}
                                  onChange={e => updateWorkPrintRow(workId, i, "price", e.target.value)}
                                  placeholder="e.g. $150"
                                  className="w-24 border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground"
                                />
                                <button type="button" onClick={() => removeWorkPrintRow(workId, i)}
                                  className="text-[11px] text-muted-foreground hover:text-foreground">✕</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addWorkPrintRow(workId)}
                              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                              + Add size
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Artist statement ─────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-border pt-8">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Artist statement</h2>
          <p className="text-[11px] text-muted-foreground">A short statement about this body of work. Shown below the commerce buttons on your storefront.</p>
        </div>
        <textarea
          value={artistStatement}
          onChange={e => setArtistStatement(e.target.value)}
          rows={4}
          placeholder="A short statement about this body of work or campaign…"
          className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground resize-none"
        />
        {/* Shipping rates */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1">
            <label className="text-xs font-medium">Shipping (optional)</label>
            <p className="text-[11px] text-muted-foreground">
              Set flat-rate postage for buyers who can&apos;t take the work in person.
              Stripe will present both options at checkout and collect the buyer&apos;s address.
              Leave blank if not offering postage.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">NZ delivery (NZD)</label>
              <input
                type="number"
                value={shippingNzDollars}
                onChange={e => setShippingNzDollars(e.target.value)}
                placeholder="e.g. 20"
                min="0"
                step="0.01"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">International (NZD)</label>
              <input
                type="number"
                value={shippingIntlDollars}
                onChange={e => setShippingIntlDollars(e.target.value)}
                placeholder="e.g. 60"
                min="0"
                step="0.01"
                className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black bg-background"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSaveDetails}
          disabled={saving}
          className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save storefront"}
        </button>
      </section>

      {/* ── Production files (partner campaigns only) ────────────────────── */}
      {isPartnerCampaign && (
        <section className="space-y-5 border-t border-border pt-8">
          <div className="space-y-1">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Production Files</h2>
            <p className="text-[11px] text-muted-foreground">
              Upload print-ready files for your partner. Max 10 MB per file.
              For larger files, email directly to{" "}
              <a href="mailto:hello@patronage.nz" className="underline underline-offset-2">hello@patronage.nz</a>{" "}
              with your campaign ref: <span className="font-mono">{campaign.slug}</span>
            </p>
          </div>

          {/* Production status badge */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              Production status
            </span>
            <span className={`text-[11px] px-2 py-0.5 font-medium rounded-full ${
              campaign.production_status === "approved" ? "bg-green-100 text-green-700"
                : campaign.production_status === "files_submitted" ? "bg-blue-50 text-blue-700"
                : "bg-stone-100 text-stone-600"
            }`}>
              {PRODUCTION_STATUS_LABEL[campaign.production_status] ?? campaign.production_status}
            </span>
          </div>

          {/* Upload */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Upload file</label>
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="text-sm file:mr-3 file:border file:border-black file:bg-transparent file:px-3 file:py-1 file:text-xs file:hover:bg-muted file:transition-colors cursor-pointer disabled:opacity-50"
            />
            {uploading && <p className="text-[11px] text-muted-foreground">Uploading…</p>}
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="divide-y divide-border border border-border">
              {files.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">{f.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.file_type?.replace("_", " ") ?? "file"}
                      {f.file_size_bytes ? ` · ${fmtBytes(f.file_size_bytes)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
                    >
                      View
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f.id)}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Publish / submit ─────────────────────────────────────────────── */}
      <section className="border-t border-border pt-8 space-y-5">
        {/* Checklist */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Ready to publish?</p>
          <div className="space-y-1">
            <p className={`text-sm flex items-center gap-2 ${heroWorkId ? "text-foreground" : "text-muted-foreground"}`}>
              <span>{heroWorkId ? "☑" : "☐"}</span>
              Hero artwork selected
            </p>
            {isPartnerCampaign && (
              <p className={`text-sm flex items-center gap-2 ${files.length > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                <span>{files.length > 0 ? "☑" : "☐"}</span>
                Production files uploaded
              </p>
            )}
            <p className={`text-sm flex items-center gap-2 ${canPublish ? "text-foreground" : "text-muted-foreground"}`}>
              <span>{canPublish ? "☑" : "☐"}</span>
              Ready to {isPartnerCampaign ? "submit" : "publish"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePublish}
          disabled={!canPublish || publishing || isLive || isSubmitted}
          className="text-sm border border-black bg-black text-white px-6 py-3 hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {publishing
            ? "Publishing…"
            : isLive
              ? "Storefront is live"
              : isSubmitted
                ? "Submitted for approval"
                : isPartnerCampaign
                  ? "Submit for approval →"
                  : "Publish storefront →"}
        </button>
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
