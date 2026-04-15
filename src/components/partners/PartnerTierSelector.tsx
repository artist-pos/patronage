"use client";

import { useState } from "react";
import { OpportunitySubmissionForm } from "@/components/partners/OpportunitySubmissionForm";
import { ActivationsColumn } from "@/components/partners/ActivationsColumn";

type Tier = "standard" | "featured" | "pipeline";

const TIERS = [
  {
    id: "standard" as const,
    label: "Standard",
    price: "Free",
    popular: false,
    body: "Listed in feed, search, and weekly digest. Reviewed within 2 business days.",
  },
  {
    id: "featured" as const,
    label: "Featured",
    strikePrice: "$150",
    price: "$75 NZD",
    popular: false,
    body: "Pinned to top of feed, homepage, and digest email. Shared on Patronage socials.",
  },
  {
    id: "pipeline" as const,
    label: "Pipeline",
    price: "First round free",
    popular: true,
    body: "Artists apply with their Patronage profile — portfolio, CV, artist statement. Dashboard, custom questions, status tracking.",
  },
] as const;

interface Props {
  isLoggedIn: boolean;
  partnerName: string | null;
}

export function PartnerTierSelector({ isLoggedIn, partnerName }: Props) {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);

  const pipelineSelected = selectedTier === "pipeline";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">

      {/* ── Left column — List an opportunity ─────────────────────────────── */}
      <div className="space-y-8">
        <div className="space-y-2 border-b border-black pb-6">
          <h2 className="text-xl font-semibold tracking-tight">List an opportunity</h2>
          <p className="text-sm text-muted-foreground">
            Select a listing type to get started.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIERS.map(tier => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTier(tier.id)}
              className={`relative text-left border-2 p-4 space-y-2 transition-colors hover:border-black ${
                selectedTier === tier.id ? "border-black" : "border-border"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-2.5 left-3 bg-black text-white text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wider">
                  Most popular
                </span>
              )}
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">{tier.label}</p>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  {"strikePrice" in tier && tier.strikePrice && (
                    <s className="text-[11px] text-muted-foreground font-mono">{tier.strikePrice}</s>
                  )}
                  <span className="text-xs font-medium font-mono">{tier.price}</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{tier.body}</p>
            </button>
          ))}
        </div>

        {/* Featured add-on for Pipeline */}
        {pipelineSelected && (
          <div className="border border-border px-4 py-3 text-sm text-muted-foreground">
            <p className="text-xs">
              <span className="font-medium text-foreground">Add featured placement</span>
              {" — "}
              <s className="opacity-60">$150</s>
              {" "}
              <span className="font-medium text-foreground">$75 NZD</span>
            </p>
            <p className="text-[11px] mt-0.5 opacity-70">
              Pinned to top of feed and weekly digest for the duration of your listing.
            </p>
          </div>
        )}

        {/* Small print */}
        <p className="text-xs text-muted-foreground">
          Your first Pipeline round is free. No commitment, no card required.
          Featured rate is introductory and subject to change.
        </p>

        {/* Submission form — expands below pricing on selection */}
        {selectedTier && (
          <div className="border-t border-black pt-8 space-y-2">
            <div className="space-y-0.5">
              <h3 className="text-base font-semibold">
                {selectedTier === "standard" && "Standard listing"}
                {selectedTier === "featured" && "Featured listing"}
                {selectedTier === "pipeline" && "Pipeline opportunity"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedTier === "pipeline"
                  ? "Fill in the details below, then configure your application pipeline."
                  : "Fill in the details below. We review every submission within two business days."}
              </p>
            </div>
            <OpportunitySubmissionForm
              isLoggedIn={isLoggedIn}
              partnerName={partnerName}
              initialTier={selectedTier}
            />
          </div>
        )}
      </div>

      {/* ── Right column — cross-fades between Activations and Pipeline config ─ */}
      <div className="relative min-h-[400px]">
        {/* Activations — shown when pipeline not selected */}
        <div
          className="transition-opacity duration-300"
          style={{ opacity: pipelineSelected ? 0 : 1, pointerEvents: pipelineSelected ? "none" : "auto" }}
        >
          <ActivationsColumn />
        </div>

        {/* Pipeline config panel — shown on desktop when pipeline selected */}
        {pipelineSelected && (
          <div
            className="hidden lg:block absolute inset-0 transition-opacity duration-300"
            style={{ opacity: pipelineSelected ? 1 : 0 }}
          >
            <PipelineInfoPanel />
          </div>
        )}
      </div>

    </div>
  );
}

/** Shown in the right column on desktop when Pipeline tier is selected. */
function PipelineInfoPanel() {
  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-black pb-6">
        <h2 className="text-xl font-semibold tracking-tight">Pipeline</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Manage the full application lifecycle through Patronage. Artists apply with their
          profile — no emails, no spreadsheets.
        </p>
      </div>

      <div className="space-y-0">
        {[
          { step: "01", heading: "Custom application questions", body: "Add short-answer, file upload, or URL fields. We provide smart defaults based on your opportunity type." },
          { step: "02", heading: "Shortlisting dashboard", body: "Review applications, leave notes, and move artists through stages — pending, shortlisted, selected." },
          { step: "03", heading: "Status tracking", body: "Artists see their application status in real time. No manual updates required." },
          { step: "04", heading: "Production pipeline", body: "Once selected, artists upload final assets through the platform. You download print-ready files with one click." },
          { step: "05", heading: "Impact reporting", body: "6 and 12-month automated follow-ups collect outcome data. Aggregated into a clean impact report for your organisation." },
        ].map(({ step, heading, body }) => (
          <div key={step} className="flex gap-4 border-t border-border py-4">
            <span className="font-mono text-xs text-muted-foreground pt-0.5 shrink-0 w-6">{step}</span>
            <div className="space-y-1">
              <p className="text-sm font-semibold">{heading}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border p-4 space-y-2">
        <p className="text-xs font-medium">First round free</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Your first Pipeline round is free with no commitment. After that, pricing is based on
          the number of opportunities you run per year. Get in touch to discuss.
        </p>
        <a
          href="mailto:hello@patronage.nz?subject=Pipeline%20enquiry"
          className="inline-block text-xs underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          Enquire about Pipeline →
        </a>
      </div>
    </div>
  );
}
