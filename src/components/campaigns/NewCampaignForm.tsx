"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSelfManagedCampaign } from "@/app/studio/campaigns/actions";
import { submitCustomCampaignEnquiry } from "@/app/studio/campaigns/enquiry-action";

// These are the artist self-serve types only.
// Partner activation types (hoarding, billboard, truck_curtain, packaging) are
// created automatically from the pipeline and never shown here.
const ARTIST_CAMPAIGN_TYPES = [
  { value: "art_fair",    label: "Art Fair",    description: "Booth signage and QR labels for fairs and markets." },
  { value: "exhibition",  label: "Exhibition",  description: "Gallery or institutional exhibition — solo or group show." },
  { value: "market_stall", label: "Market Stall", description: "Artist market, weekend market, or pop-up stall." },
  { value: "pop_up",      label: "Pop-up",       description: "Temporary pop-up space or short-run installation." },
  { value: "custom_live", label: "Custom / Live Experience", description: "Something else? Tell us what you're planning and we'll help set it up." },
] as const;

type ArtistTypeValue = typeof ARTIST_CAMPAIGN_TYPES[number]["value"];
type CreateableType = Exclude<ArtistTypeValue, "custom_live">;

export function NewCampaignForm({ username }: { username: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  void startTransition;

  const [step, setStep] = useState<"type" | "details" | "enquiry">("type");
  const [campaignType, setCampaignType] = useState<ArtistTypeValue | null>(null);

  // Details step
  const [title, setTitle] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enquiry step
  const [enquiryName, setEnquiryName] = useState("");
  const [enquiryEmail, setEnquiryEmail] = useState("");
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySent, setEnquirySent] = useState(false);

  const selectedType = ARTIST_CAMPAIGN_TYPES.find(t => t.value === campaignType);

  async function handleCreate() {
    if (!campaignType || campaignType === "custom_live" || !title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createSelfManagedCampaign({
      title: title.trim(),
      campaign_type: campaignType as CreateableType,
      partner_name: partnerName.trim() || undefined,
      campaign_start_date: startDate || undefined,
      campaign_end_date: endDate || undefined,
      location_address: location.trim() || undefined,
      production_specs: notes.trim() || undefined,
    });
    setCreating(false);
    if (result.error) { setError(result.error); return; }
    if (result.campaignId) router.push(`/studio/campaigns/${result.campaignId}`);
  }

  async function handleEnquirySubmit() {
    if (!enquiryName.trim() || !enquiryEmail.trim() || !enquiryMessage.trim()) return;
    setEnquirySending(true);
    const result = await submitCustomCampaignEnquiry({
      name: enquiryName.trim(),
      email: enquiryEmail.trim(),
      message: enquiryMessage.trim(),
    });
    setEnquirySending(false);
    if (result.error) { setError(result.error); return; }
    setEnquirySent(true);
  }

  // ── Step: Type ─────────────────────────────────────────────────────────────
  if (step === "type") {
    return (
      <div className="space-y-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Select campaign type
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ARTIST_CAMPAIGN_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setCampaignType(t.value);
                setStep(t.value === "custom_live" ? "enquiry" : "details");
              }}
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

  // ── Step: Custom / Live Experience enquiry ─────────────────────────────────
  if (step === "enquiry") {
    if (enquirySent) {
      return (
        <div className="space-y-4 max-w-md">
          <p className="text-sm font-medium">We'll be in touch within 48 hours.</p>
          <p className="text-sm text-muted-foreground">
            Thanks for reaching out. We'll review your idea and follow up at the email you provided.
          </p>
          <button
            type="button"
            onClick={() => router.push("/studio?section=campaigns")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            Back to Studio →
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6 max-w-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setCampaignType(null); setStep("type"); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm text-muted-foreground">·</span>
          <span className="text-sm font-medium">Custom / Live Experience</span>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">Tell us what you're planning</p>
          <p className="text-[11px] text-muted-foreground">
            We'll help you set it up. This won't create a campaign — it's a direct enquiry to the Patronage team.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Your name *</label>
            <input
              type="text"
              value={enquiryName}
              onChange={e => setEnquiryName(e.target.value)}
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Your email *</label>
            <input
              type="email"
              value={enquiryEmail}
              onChange={e => setEnquiryEmail(e.target.value)}
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">What are you planning? *</label>
            <textarea
              value={enquiryMessage}
              onChange={e => setEnquiryMessage(e.target.value)}
              rows={5}
              placeholder="Describe your live experience, performance, activation, or event idea…"
              className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black resize-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="button"
          onClick={handleEnquirySubmit}
          disabled={enquirySending || !enquiryName.trim() || !enquiryEmail.trim() || !enquiryMessage.trim()}
          className="text-sm border border-black bg-black text-white px-5 py-2.5 hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enquirySending ? "Sending…" : "Send enquiry →"}
        </button>
      </div>
    );
  }

  // ── Step: Details ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-lg">
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
            placeholder={
              campaignType === "art_fair" ? "e.g. Wellington Art Fair 2025"
                : campaignType === "exhibition" ? "e.g. Solo exhibition — City Gallery"
                : campaignType === "market_stall" ? "e.g. Sunday Artisan Market"
                : "Campaign name"
            }
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
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything else useful"
            className="w-full border border-border px-3 py-2 text-sm focus:outline-none focus:border-black placeholder:text-muted-foreground resize-none"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={!title.trim() || creating}
        className="text-sm border border-black bg-black text-white px-5 py-2.5 hover:bg-white hover:text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {creating ? "Creating…" : "Create campaign →"}
      </button>
    </div>
  );
}
