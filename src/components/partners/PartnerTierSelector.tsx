"use client";

import { useRef, useState } from "react";
import { OpportunitySubmissionForm } from "@/components/partners/OpportunitySubmissionForm";
import { ActivationsColumn } from "@/components/partners/ActivationsColumn";
import { PipelineConfigPanel, type PipelineExternalConfig } from "@/components/partners/PipelineConfigPanel";
import type { ActivationType } from "@/app/partners/page";

type Tier = "standard" | "featured" | "pipeline";

const STANDARD_TIER = {
  id: "standard" as const,
  label: "Standard",
  price: "Free",
  popular: false,
  body: "Listed in feed, search, and weekly digest. Reviewed within 2 business days.",
};

const FEATURED_TIER = {
  id: "featured" as const,
  label: "Featured",
  strikePrice: "$150",
  price: "$75 NZD",
  popular: false,
  body: "Pinned to top of feed, homepage, and digest email. Shared on Patronage socials.",
};

interface Props {
  isLoggedIn: boolean;
  partnerName: string | null;
  activationTypes: ActivationType[];
  isAdmin: boolean;
  /** When true, this partner has already used their free pipeline round —
   *  show $200 pricing instead of "first round free" copy. */
  pipelineFirstRoundUsed: boolean;
}

export function PartnerTierSelector({ isLoggedIn, partnerName, activationTypes, isAdmin, pipelineFirstRoundUsed }: Props) {
  const pipelineTier = pipelineFirstRoundUsed
    ? {
        id: "pipeline" as const,
        label: "Pipeline",
        price: "$200 NZD",
        popular: true,
        body: "Artists apply with their Patronage profile — portfolio, CV, artist statement. Dashboard, custom questions, status tracking.",
      }
    : {
        id: "pipeline" as const,
        label: "Pipeline",
        price: "First round free",
        popular: true,
        body: "Artists apply with their Patronage profile — portfolio, CV, artist statement. Dashboard, custom questions, status tracking.",
      };

  const TIERS = [STANDARD_TIER, FEATURED_TIER, pipelineTier] as const;
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  // Featured placement add-on (for Standard and Pipeline tiers; Featured is always true)
  const [addFeatured, setAddFeatured] = useState(false);
  const [pipelineConfigActive, setPipelineConfigActive] = useState(false);
  const [pipelineExternalConfig, setPipelineExternalConfig] = useState<PipelineExternalConfig | null>(null);

  const sectionRef = useRef<HTMLDivElement>(null);

  const pipelineSelected = selectedTier === "pipeline";

  // The effective featured value: Featured tier is always featured; others use addFeatured checkbox
  const isFeaturedEffective = selectedTier === "featured" ? true : addFeatured;

  function handleTierSelect(tier: Tier) {
    setSelectedTier(tier);
    // Reset add-on when switching tiers (Featured tier is always featured, no add-on needed)
    setAddFeatured(false);
    if (tier !== "pipeline") {
      setPipelineConfigActive(false);
      setPipelineExternalConfig(null);
    }
  }

  function handleConfigurePipeline(config: PipelineExternalConfig) {
    setPipelineExternalConfig(config);
    setPipelineConfigActive(true);
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function handlePipelineConfigChange(updated: Partial<PipelineExternalConfig>) {
    setPipelineExternalConfig(prev => prev ? { ...prev, ...updated } : null);
  }

  // ── Right column header content — switches based on state ──────────────────
  const rightHeader = pipelineSelected && pipelineConfigActive
    ? { title: "Application setup", desc: "Configure how artists apply. Defaults for your opportunity type are pre-filled — customise as needed." }
    : pipelineSelected
    ? { title: "Pipeline", desc: "Manage the full application lifecycle through Patronage. Artists apply with their profile — no emails, no spreadsheets." }
    : { title: "Activations", desc: "Partner with us to commission artists for surfaces you already own — hoardings, vehicles, packaging, screens — and turn existing budgets into public art with full impact reporting." };

  return (
    <div ref={sectionRef}>
      {/*
        4-item grid so both column headers share the same auto-row height.
        On desktop: items 1+2 are the headers (same row), items 3+4 are the content.
        On mobile: single column, all stack.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-[auto_1fr] gap-x-16 lg:gap-x-20">

        {/* ── Left header ───────────────────────────────────────────────── */}
        <div className="space-y-2 border-b border-black pb-6 mb-8">
          <h2 className="text-xl font-semibold tracking-tight">List an opportunity</h2>
          <p className="text-sm text-muted-foreground">Select a listing type to get started.</p>
        </div>

        {/* ── Right header ──────────────────────────────────────────────── */}
        <div className="hidden lg:block space-y-2 border-b border-black pb-6 mb-8">
          <h2 className="text-xl font-semibold tracking-tight">{rightHeader.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{rightHeader.desc}</p>
        </div>

        {/* ── Left content ──────────────────────────────────────────────── */}
        <div className="space-y-8 lg:row-start-2">

          {/* Pricing cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TIERS.map(tier => (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleTierSelect(tier.id)}
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

          {/* Featured placement add-on — only relevant for Pipeline (Standard can upgrade to Featured tier; Featured already includes it) */}
          {selectedTier === "pipeline" && (
            <label className="flex items-start gap-3 cursor-pointer border border-border px-4 py-3">
              <input
                type="checkbox"
                checked={addFeatured}
                onChange={e => setAddFeatured(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <div className="space-y-0.5">
                <p className="text-xs">
                  <span className="font-medium text-foreground">Add featured placement</span>
                  {" — "}
                  <s className="text-muted-foreground opacity-60">$150</s>
                  {" "}
                  <span className="font-medium text-foreground">$75 NZD</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pinned to top of feed and weekly digest for the duration of your listing.
                </p>
              </div>
            </label>
          )}

          {/* Small print */}
          {selectedTier === "pipeline" && (
            <p className="text-xs text-muted-foreground">
              {pipelineFirstRoundUsed
                ? "Pipeline rounds are $200 NZD each. Featured rate is introductory and subject to change."
                : "Your first Pipeline round is free. No commitment, no card required. Featured rate is introductory and subject to change."}
            </p>
          )}
          {(selectedTier === "featured" || (selectedTier === "pipeline" && pipelineFirstRoundUsed)) && (
            <p className="text-[11px] text-muted-foreground">
              Paid tiers add a 2.9% + 30c card processing fee at checkout. Itemised on the Stripe payment page.
            </p>
          )}

          {/* Mobile-only: render the right column content below the cards */}
          <div className="lg:hidden border-t border-black pt-8 space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">{rightHeader.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{rightHeader.desc}</p>
            <div className="pt-4">
              {pipelineSelected && pipelineConfigActive && pipelineExternalConfig ? (
                <PipelineConfigPanel
                  config={pipelineExternalConfig}
                  onChange={handlePipelineConfigChange}
                />
              ) : pipelineSelected ? (
                <PipelineInfoPanel pipelineFirstRoundUsed={pipelineFirstRoundUsed} />
              ) : (
                <ActivationsColumn activationTypes={activationTypes} isAdmin={isAdmin} hideHeader />
              )}
            </div>
          </div>


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
                key={selectedTier}
                isLoggedIn={isLoggedIn}
                partnerName={partnerName}
                initialTier={selectedTier}
                isFeaturedOverride={isFeaturedEffective}
                onConfigurePipeline={selectedTier === "pipeline" ? handleConfigurePipeline : undefined}
                pipelineConfigOverride={pipelineExternalConfig}
              />
            </div>
          )}
        </div>

        {/* ── Right content ─────────────────────────────────────────────── */}
        <div className="hidden lg:block lg:row-start-2 relative">

          {/* Activations — visible when no pipeline selected */}
          <div
            className="transition-opacity duration-300"
            style={{
              opacity: pipelineSelected ? 0 : 1,
              pointerEvents: pipelineSelected ? "none" : "auto",
            }}
          >
            {/* Header already rendered above; pass hideHeader so ActivationsColumn skips it */}
            <ActivationsColumn activationTypes={activationTypes} isAdmin={isAdmin} hideHeader />
          </div>

          {/* Pipeline info panel — visible when pipeline selected but config not yet active */}
          {pipelineSelected && !pipelineConfigActive && (
            <div className="absolute inset-0">
              <PipelineInfoPanel pipelineFirstRoundUsed={pipelineFirstRoundUsed} />
            </div>
          )}

          {/* Pipeline config panel — visible after "Configure pipeline →" click */}
          {pipelineSelected && pipelineConfigActive && pipelineExternalConfig && (
            <div className="absolute inset-0">
              <PipelineConfigPanel
                config={pipelineExternalConfig}
                onChange={handlePipelineConfigChange}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/** Shown in the right column when Pipeline tier is selected but not yet configured. */
function PipelineInfoPanel({ pipelineFirstRoundUsed }: { pipelineFirstRoundUsed: boolean }) {
  return (
    <div className="space-y-6">
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
        <p className="text-xs font-medium">
          {pipelineFirstRoundUsed ? "$200 NZD per round" : "First round free"}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {pipelineFirstRoundUsed
            ? "Each Pipeline round is $200 NZD. Running multiple opportunities per year? Get in touch about volume pricing."
            : "Your first Pipeline round is free with no commitment. After that, $200 NZD per round. Running multiple opportunities per year? Get in touch about volume pricing."}
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
