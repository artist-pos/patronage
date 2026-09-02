"use client";

import { useState } from "react";
import Link from "next/link";

// ── Section B: "What brings you here?" type selector ─────────────────────────
// Single-select cards; picking one reveals a recommendation panel and filters
// the tier list below to the tiers relevant to that organisation type.

type TypeKey = "arts" | "residency" | "gallery" | "council" | "corporate" | "assetmanager";

const TYPES: Array<{ key: TypeKey; title: string; desc: string }> = [
  { key: "arts", title: "Arts organisation", desc: "Distribute grants, run open calls, manage funding rounds" },
  { key: "residency", title: "Residency / Studio programme", desc: "Manage residency applications, committee review, artist selection" },
  { key: "gallery", title: "Gallery / Museum", desc: "Exhibition proposals, open calls, collection building" },
  { key: "council", title: "Council / Government", desc: "Public art commissions, community arts programmes, procurement" },
  { key: "corporate", title: "Corporate / Brand", desc: "Activations, packaging, ESG-aligned art programmes" },
  { key: "assetmanager", title: "Property / Asset manager", desc: "Hoardings, fleet, utility boxes, vacant sites across your portfolio" },
];

const RECS: Record<TypeKey, { title: string; desc: string; pills: Array<[string, string]> }> = {
  arts: {
    title: "Built for grants & open calls",
    desc: "Run your funding rounds on Pipeline: artists apply with their Patronage profile pre-attached, you score and shortlist on one dashboard, and impact reports generate themselves.",
    pills: [["#tiers", "See Pipeline"], ["#pricing", "Pricing"]],
  },
  residency: {
    title: "Built for residency applications",
    desc: "Pipeline replaces the shared inbox, with committee scoring on rubrics, staged notifications when you select artists, and a record of every round for next year.",
    pills: [["#pipeline", "How Pipeline works"], ["#pricing", "Pricing"]],
  },
  gallery: {
    title: "Built for exhibition proposals & open calls",
    desc: "Applications arrive with full artist profiles attached, so there is no separate portfolio review. Pipeline handles scoring, selection, and follow-up in one place.",
    pills: [["#tiers", "See Pipeline"], ["#pricing", "Pricing"]],
  },
  council: {
    title: "Built for public art at scale",
    desc: "Activations manages the whole process on your surfaces: brief, open call, production, installation, and reporting. Art Strategy helps first if you need to plan before you commission.",
    pills: [["#activations", "See Activations"], ["#strategy", "Art Strategy"]],
  },
  corporate: {
    title: "Built for brand & ESG-aligned programmes",
    desc: "Activations turns hoardings, packaging, or vehicle fleets into commissioned artwork with full production management. Art Strategy scopes the programme first if starting from zero.",
    pills: [["#activations", "See Activations"], ["#strategy", "Art Strategy"]],
  },
  assetmanager: {
    title: "Built for hoardings, fleet & utility assets",
    desc: "We source and manage artists for surfaces you already own, with full production, QR-linked provenance, and impact reporting across your portfolio.",
    pills: [["#activations", "See Activations"], ["#strategy", "Art Strategy"]],
  },
};

// ── Section C: the four tiers ─────────────────────────────────────────────────

const FEATURE = "font-mono text-xs text-[color:var(--fg-muted)]";
const MOCK_LABEL = "mb-3 font-mono text-[9px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]";

function TierNum({ n }: { n: string }) {
  return (
    <span className="border border-border px-[7px] py-[2px] font-mono text-[10px] text-[color:var(--fg-muted)]">
      {n}
    </span>
  );
}

export function PartnerTypeTiers() {
  const [selected, setSelected] = useState<TypeKey | null>(null);
  const rec = selected ? RECS[selected] : null;
  const restricted: TypeKey[] = ["council", "corporate", "assetmanager"];
  const showRestrictedTiers = !selected || restricted.includes(selected);

  return (
    <>
      {/* ══ B. Partner type selector ══ */}
      <section id="type" className="scroll-mt-16 border-b border-border bg-feed-bg px-5 py-11 sm:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            What brings you here?
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelected(selected === t.key ? null : t.key)}
                className={`px-5 pb-[22px] pt-5 text-left transition-colors ${
                  selected === t.key
                    ? "border border-brand bg-[color:var(--tint)]"
                    : "border border-border bg-card"
                }`}
              >
                <span className="mb-1.5 block text-[15px] font-semibold">{t.title}</span>
                <span className="block text-[12.5px] leading-[1.55] text-[color:var(--fg-muted)]">
                  {t.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Recommendation panel */}
          {rec && (
            <div className="mt-4 border-l-[3px] border-brand bg-card px-[22px] py-[18px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-brand">
                    Recommended for you
                  </p>
                  <p className="mb-[5px] text-base font-semibold tracking-[-0.01em]">{rec.title}</p>
                  <p className="mb-3.5 max-w-[520px] text-[13.5px] leading-[1.55] text-[color:var(--fg-muted)]">
                    {rec.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {rec.pills.map(([href, label]) => (
                      <a
                        key={href + label}
                        href={href}
                        className="border border-brand px-3 py-1.5 font-mono text-[11px] text-brand transition-colors hover:bg-[color:var(--tint)]"
                      >
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss recommendation"
                  onClick={() => setSelected(null)}
                  className="shrink-0 p-0.5 font-mono text-sm leading-none text-[color:var(--fg-subtle)] transition-colors hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══ C. Four tiers ══ */}
      <section id="tiers" className="scroll-mt-16 border-b border-border px-5 py-16 sm:px-12">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            The product
          </p>
          <h2 className="mb-3 text-[32px] font-semibold tracking-[-0.025em]">
            Start free. Upgrade when you need more.
          </h2>
          <p className="mb-10 max-w-[560px] text-[15px] text-[color:var(--fg-muted)]">
            Four tiers, from self-serve listing to full-service commissioning. Pick where you fit.
          </p>

          <div className="flex flex-col">
            {/* Tier 1 — List */}
            <div className="grid grid-cols-1 items-center gap-5 border-b border-border py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
              <div>
                <div className="mb-2.5 flex items-baseline gap-2.5">
                  <TierNum n="01" />
                  <span className="font-mono text-[11px] text-[color:var(--success)]">FREE</span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">List</h3>
                <p className="mb-4 text-sm leading-[1.6] text-[color:var(--fg-muted)]">
                  List an opportunity in the aggregator. Feed, search, and the weekly artist
                  digest. Reviewed within 2 business days. Zero commitment.
                </p>
                <div className="mb-5 flex flex-col gap-[7px]">
                  <p className={FEATURE}>→ Feed &amp; search placement</p>
                  <p className={FEATURE}>→ Weekly artist digest inclusion</p>
                  <p className={FEATURE}>→ Basic view tracking</p>
                </div>
                <Link
                  href="/partner/list-free"
                  className="inline-block bg-brand px-[18px] py-[9px] text-[13px] font-medium text-white transition-opacity hover:opacity-85"
                >
                  List for free →
                </Link>
              </div>
              <div className="bg-feed-bg p-[22px]">
                <p className={MOCK_LABEL}>Listing form</p>
                <div className="flex flex-col gap-2.5 bg-card p-4">
                  <div>
                    <p className="mb-[3px] font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]">Title</p>
                    <p className="border border-border px-2.5 py-2 text-[13px] text-[color:var(--fg-muted)]">
                      Public Art Commission, Cuba St
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-[3px] font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]">Type</p>
                      <p className="border border-border px-2.5 py-2 text-[13px] text-[color:var(--fg-muted)]">Commission</p>
                    </div>
                    <div>
                      <p className="mb-[3px] font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]">Closes</p>
                      <p className="border border-border px-2.5 py-2 text-[13px] text-[color:var(--fg-muted)]">14 Aug 2026</p>
                    </div>
                  </div>
                  <p className="bg-foreground p-2 text-center text-xs font-medium text-background">
                    Submit for review
                  </p>
                </div>
              </div>
            </div>

            {/* Tier 2 — Pipeline */}
            <div className="grid grid-cols-1 items-center gap-5 border-b border-border py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
              <div>
                <div className="mb-2.5 flex items-baseline gap-2.5">
                  <TierNum n="02" />
                  <span className="font-mono text-[11px] text-[color:var(--fg-muted)]">
                    FREE FIRST ROUND · $200 THEREAFTER
                  </span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">Pipeline</h3>
                <p className="mb-4 text-sm leading-[1.6] text-[color:var(--fg-muted)]">
                  A managed application process. Artists apply with their Patronage profile
                  pre-attached. Replaces Google Forms, spreadsheets, and email chains.
                </p>
                <div className="mb-5 flex flex-col gap-[7px]">
                  <p className={FEATURE}>→ Kanban / table / triage dashboard</p>
                  <p className={FEATURE}>→ Committee scoring with rubrics</p>
                  <p className={FEATURE}>→ Automated 6/12-month impact reports</p>
                </div>
                <a
                  href="#pipeline"
                  className="inline-block border border-border px-[18px] py-[9px] font-mono text-[13px] text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
                >
                  See how it works ↓
                </a>
              </div>
              <div className="bg-feed-bg p-[22px]">
                <p className={MOCK_LABEL}>Pipeline dashboard</p>
                <div className="bg-card p-3.5">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="mb-1.5 font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]">Applied · 24</p>
                      <div className="h-14 bg-muted" />
                    </div>
                    <div>
                      <p className="mb-1.5 font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]">Shortlisted · 8</p>
                      <div className="h-14 border border-brand bg-[color:var(--tint)]" />
                    </div>
                    <div>
                      <p className="mb-1.5 font-mono text-[9px] uppercase text-[color:var(--fg-subtle)]">Selected · 3</p>
                      <div className="h-14 bg-[#ECFDF5]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier 3 — Art strategy & consultancy (council / corporate / asset manager) */}
            <div className={`grid-cols-1 items-center gap-5 border-b border-border py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12 ${showRestrictedTiers ? "grid" : "hidden"}`}>
              <div>
                <div className="mb-2.5 flex items-baseline gap-2.5">
                  <TierNum n="03" />
                  <span className="font-mono text-[11px] text-[color:var(--fg-muted)]">CUSTOM PRICING</span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">
                  Art strategy &amp; consultancy
                </h3>
                <p className="mb-4 text-sm leading-[1.6] text-[color:var(--fg-muted)]">
                  We advise on how to integrate art into your operations: audits, strategy,
                  artist matching, budget planning. We do the thinking for you.
                </p>
                <div className="mb-5 flex flex-col gap-[7px]">
                  <p className={FEATURE}>→ Space audits &amp; opportunity mapping</p>
                  <p className={FEATURE}>→ ESG / community-aligned strategy</p>
                  <p className={FEATURE}>→ Budget planning &amp; procurement structuring</p>
                </div>
                <a
                  href="#strategy"
                  className="inline-block border border-border px-[18px] py-[9px] font-mono text-[13px] text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
                >
                  Learn more ↓
                </a>
              </div>
              <div className="bg-feed-bg p-[22px]">
                <p className={MOCK_LABEL}>Engagement roadmap</p>
                <div className="flex flex-col gap-2.5 bg-card p-4">
                  {[["01", "Audit your spaces"], ["02", "Develop your strategy"], ["03", "Build the programme"]].map(([n, label]) => (
                    <div key={n} className="flex items-baseline gap-2.5">
                      <span className="font-mono text-[10px] text-brand">{n}</span>
                      <span className="text-[13px]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tier 4 — Activations (council / corporate / asset manager) */}
            <div className={`grid-cols-1 items-center gap-5 py-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12 ${showRestrictedTiers ? "grid" : "hidden"}`}>
              <div>
                <div className="mb-2.5 flex items-baseline gap-2.5">
                  <TierNum n="04" />
                  <span className="font-mono text-[11px] text-[color:var(--fg-muted)]">CUSTOM PRICING</span>
                </div>
                <h3 className="mb-2 text-2xl font-semibold tracking-[-0.02em]">Activations</h3>
                <p className="mb-4 text-sm leading-[1.6] text-[color:var(--fg-muted)]">
                  Full-service commissioning: brief, open call, production, installation, and
                  QR-linked reporting. We manage the entire process on your surfaces.
                </p>
                <div className="mb-5 flex flex-col gap-[7px]">
                  <p className={FEATURE}>→ Hoardings, billboards, fleet, utility boxes</p>
                  <p className={FEATURE}>→ QR-code artist provenance on every surface</p>
                  <p className={FEATURE}>→ Full production &amp; impact reporting</p>
                </div>
                <a
                  href="#activations"
                  className="inline-block border border-border px-[18px] py-[9px] font-mono text-[13px] text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
                >
                  See surfaces ↓
                </a>
              </div>
              <div className="bg-feed-bg p-[22px]">
                <p className={MOCK_LABEL}>Impact report</p>
                <div className="bg-card p-4">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <p className="text-[22px] font-semibold">14</p>
                      <p className="font-mono text-[10px] text-[color:var(--fg-muted)]">surfaces activated</p>
                    </div>
                    <div>
                      <p className="text-[22px] font-semibold">340k</p>
                      <p className="font-mono text-[10px] text-[color:var(--fg-muted)]">est. daily views</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
