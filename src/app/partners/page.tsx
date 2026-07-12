import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PartnerTypeTiers } from "@/components/partners/PartnerTypeTiers";
import { PartnerContactForm } from "@/components/partners/PartnerContactForm";
import { ActivationTiles } from "@/components/partners/ActivationTiles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Partners — Patronage",
  description:
    "List opportunities for artists across Aotearoa and Australia, or work with us on activations — hoardings, billboards, and surfaces that turn existing budgets into commissioned public art.",
};

export type ActivationType = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

const SIDE_LINKS: Array<[string, string]> = [
  ["#top", "Overview"],
  ["#type", "Who you are"],
  ["#tiers", "The tiers"],
  ["#pipeline", "Pipeline"],
  ["#activations", "Activations"],
  ["#strategy", "Art strategy"],
  ["#pricing", "Pricing"],
  ["#contact", "Contact"],
];

const PIPELINE_STEPS: Array<[string, string, string, string]> = [
  ["01", "Artist applies", "Portfolio, CV, and practice statement auto-attach. No PDFs.", "application form"],
  ["02", "You review", "Kanban board, committee scoring, configurable rubrics.", "kanban board"],
  ["03", "You select", "Staged batch notifications, next steps sent automatically.", "notification flow"],
  ["04", "Delivery", "Production assets uploaded, signed download links generated.", "asset delivery"],
  ["05", "Impact", "Automated 6/12-month follow-up, exportable board report.", "impact report"],
];

const ACTIVATION_PROCESS = ["Brief", "Open call", "Selection", "Production", "Installation", "Reporting"];

const STRATEGY_SERVICES: Array<[string, string]> = [
  ["Space audit", "Identifying surfaces and opportunities across your estate"],
  ["Strategy development", "Aligning to ESG, community, or brand objectives"],
  ["Programme design", "Annual commissioning calendar, budget allocation"],
  ["Artist matching", "From the Patronage network"],
  ["Ongoing management", "Programme management and reporting"],
];

const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]";

export default async function PartnersPage() {
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: activationTypes },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("activation_types")
      .select("id, title, description, image_url, sort_order, is_active")
      .order("sort_order"),
  ]);

  let pipelineFirstRoundUsed = false;
  let isAdmin = false;
  if (user) {
    const [{ count: paidCount }, { data: viewerProfile }] = await Promise.all([
      supabase
        .from("pipeline_entry_payments")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", user.id)
        .eq("status", "paid"),
      supabase.from("profiles").select("role").eq("id", user.id).single(),
    ]);
    pipelineFirstRoundUsed = (paidCount ?? 0) > 0;
    isAdmin = ["admin", "owner"].includes(viewerProfile?.role ?? "");
  }

  return (
    <div id="top" className="mx-auto flex max-w-[1520px] items-start scroll-mt-16">

      {/* ── Sticky jump nav — desktop only ── */}
      <nav
        aria-label="Page navigation"
        className="sticky top-[68px] hidden max-h-[calc(100vh-68px)] w-[200px] shrink-0 flex-col self-start overflow-y-auto border-r border-border py-7 lg:flex"
      >
        <p className="px-5 pb-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
          On this page
        </p>
        {SIDE_LINKS.map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="block px-5 py-[9px] font-mono text-xs text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
          >
            {label}
          </a>
        ))}
      </nav>

      <main className="min-w-0 flex-1">

        {/* ══ A. Hero ══ */}
        <section className="border-b border-border px-5 pb-8 pt-10 sm:px-12 lg:pb-16 lg:pt-[88px]">
          <div className="mx-auto max-w-[1280px]">
            <p className={`${EYEBROW} mb-5`}>For partners</p>
            <h1 className="mb-5 max-w-[820px] text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] lg:text-[48px]">
              Art infrastructure for your organisation.
            </h1>
            <p className="mb-8 max-w-[560px] text-[17px] leading-[1.6] text-[color:var(--fg-muted)]">
              List opportunities, manage applications, commission artists, or let us build your
              art programme. Free to start.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/partner/list-free"
                className="bg-brand px-[22px] py-[11px] text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                List for free →
              </Link>
              <a
                href="#strategy"
                className="border border-border px-[22px] py-[11px] font-mono text-[13px] text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
              >
                Talk to us about strategy →
              </a>
            </div>
          </div>
        </section>

        {/* ══ B + C. Type selector + tiers (interactive) ══ */}
        <PartnerTypeTiers />

        {/* ══ D. Pipeline walkthrough ══ */}
        <section id="pipeline" className="scroll-mt-16 border-b border-border bg-feed-bg px-5 py-16 sm:px-12">
          <div className="mx-auto max-w-[1280px]">
            <p className={`${EYEBROW} mb-2.5`}>How Pipeline works</p>
            <h2 className="mb-9 text-[30px] font-semibold tracking-[-0.022em]">
              From application to impact report.
            </h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              {PIPELINE_STEPS.map(([n, title, desc, mock]) => (
                <div key={n} className="bg-card px-4 py-[18px]">
                  <span className="font-mono text-[11px] text-brand">{n}</span>
                  <p className="mb-1.5 mt-2 text-[13px] font-semibold">{title}</p>
                  <p className="mb-3 text-[11.5px] leading-[1.5] text-[color:var(--fg-muted)]">{desc}</p>
                  <div className="flex h-[60px] items-center justify-center bg-feed-bg">
                    <span className="font-mono text-[9px] text-[color:var(--fg-subtle)]">{mock}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={user ? "/partner/opportunities/new?type=pipeline" : "/auth/signup?intent=partner"}
                className="bg-brand px-[22px] py-[11px] text-sm font-medium text-white transition-opacity hover:opacity-85"
              >
                {pipelineFirstRoundUsed ? "List with Pipeline →" : "List with Pipeline — first round free →"}
              </Link>
              <a
                href="#pricing"
                className="font-mono text-[13px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
              >
                See pricing
              </a>
            </div>
          </div>
        </section>

        {/* ══ E. Activations showcase ══ */}
        <section id="activations" className="scroll-mt-16 border-b border-border px-5 py-16 sm:px-12">
          <div className="mx-auto max-w-[1280px]">
            <p className={`${EYEBROW} mb-2.5`}>Activations</p>
            <h2 className="mb-9 text-[30px] font-semibold tracking-[-0.022em]">
              Art on your surfaces.
            </h2>
            <ActivationTiles
              tiles={(activationTypes ?? []) as ActivationType[]}
              isAdmin={isAdmin}
            />

            {/* Process strip */}
            <div className="flex overflow-x-auto bg-feed-bg px-6 py-5 scrollbar-hide">
              {ACTIVATION_PROCESS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-2 ${
                    i < ACTIVATION_PROCESS.length - 1 ? "mr-5 border-r border-border pr-5" : ""
                  }`}
                >
                  <span className="font-mono text-[10px] text-brand">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="whitespace-nowrap text-[12.5px]">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ F. Art strategy ══ */}
        <section id="strategy" className="scroll-mt-16 border-b border-border px-5 py-16 sm:px-12">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-2 lg:gap-16">
              <div>
                <p className={`${EYEBROW} mb-3.5`}>Art strategy &amp; consultancy</p>
                <h2 className="mb-4 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em]">
                  Not sure where to start? We audit your spaces, develop your art strategy, and
                  build the programme.
                </h2>
                <p className="mb-5 text-[15px] leading-[1.65] text-[color:var(--fg-muted)]">
                  For organisations that don&rsquo;t have internal arts expertise but want a
                  considered, ongoing relationship with art — not a one-off purchase.
                </p>
                <div className="mb-6 border-l-2 border-brand py-1 pl-4">
                  <p className="text-sm leading-[1.6]">
                    We designed WEL Networks&rsquo; utility box programme — 300 assets across
                    Hamilton, artist fees structured by panel size, anti-graffiti coating
                    positioned as asset management. That&rsquo;s what art strategy looks like.
                  </p>
                </div>
                <a
                  href="#contact"
                  className="inline-block bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
                >
                  Talk to us →
                </a>
              </div>
              <div className="flex flex-col">
                {STRATEGY_SERVICES.map(([title, desc], i) => (
                  <div
                    key={title}
                    className={`py-4 ${i < STRATEGY_SERVICES.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <p className="mb-[3px] text-sm font-medium">{title}</p>
                    <p className="text-[12.5px] text-[color:var(--fg-muted)]">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ H. Pricing + contact ══ */}
        <section id="pricing" className="scroll-mt-16 px-5 pb-20 pt-16 sm:px-12">
          <div className="mx-auto max-w-[1280px]">
            <p className={`${EYEBROW} mb-2.5`}>Pricing</p>
            <h2 className="mb-10 text-[28px] font-semibold tracking-[-0.02em]">
              Simple, transparent pricing.
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3">

              {/* Standard listing */}
              <div className="flex flex-col border-b border-border pb-7 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <p className="mb-3.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                  Standard listing
                </p>
                <p className="mb-4 text-[32px] font-semibold tracking-[-0.02em]">Free</p>
                <p className="mb-[22px] text-[13.5px] leading-[1.6] text-[color:var(--fg-muted)]">
                  Listed in the opportunity feed, search results, and weekly artist digest.
                  Reviewed within two business days.
                </p>
                <div className="mb-7 flex flex-1 flex-col gap-[11px] text-[13px] text-[color:var(--fg-muted)]">
                  <p>— Opportunity feed and search</p>
                  <p>— Weekly digest email to artists</p>
                  <p>— Save and apply tracking</p>
                  <p>— No commitment</p>
                </div>
                <Link
                  href="/partner/list-free"
                  className="border border-border p-[13px] text-center text-sm font-medium transition-colors hover:border-foreground hover:bg-feed-bg"
                >
                  List for free →
                </Link>
              </div>

              {/* Pipeline — most popular */}
              <div className="flex flex-col border-b border-border py-7 lg:border-b-0 lg:border-r lg:px-8 lg:py-0">
                <p className="mb-3.5 w-fit bg-foreground px-2 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-background">
                  Most popular
                </p>
                <p className="mb-3.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                  Pipeline
                </p>
                {pipelineFirstRoundUsed ? (
                  <>
                    <p className="mb-1 text-[32px] font-semibold tracking-[-0.02em]">$200</p>
                    <p className="mb-4 font-mono text-[11px] text-[color:var(--fg-muted)]">NZD per round</p>
                  </>
                ) : (
                  <>
                    <p className="mb-1 text-[32px] font-semibold tracking-[-0.02em]">Free</p>
                    <p className="mb-4 font-mono text-[11px] text-[color:var(--fg-muted)]">
                      first round · $200 NZD thereafter
                    </p>
                  </>
                )}
                <p className="mb-[22px] text-[13.5px] leading-[1.6] text-[color:var(--fg-muted)]">
                  Managed application pipeline with a full partner dashboard. Artists apply with
                  their Patronage profile — no emails, no spreadsheets.
                </p>
                <div className="mb-7 flex flex-1 flex-col gap-[11px] text-[13px] text-[color:var(--fg-muted)]">
                  <p>— Everything in Standard</p>
                  <p>— Custom application questions</p>
                  <p>— Full pipeline dashboard (Kanban, Table, Triage)</p>
                  <p>— Committee scoring and rubric</p>
                  <p>— Staged notification system</p>
                  <p>— Production asset delivery</p>
                  <p>— 6 and 12-month impact reporting</p>
                </div>
                <Link
                  href={user ? "/partner/opportunities/new?type=pipeline" : "/auth/signup?intent=partner"}
                  className="bg-foreground p-[13px] text-center text-sm font-medium text-background transition-opacity hover:opacity-85"
                >
                  {pipelineFirstRoundUsed ? "Configure a pipeline →" : "Start your first round free →"}
                </Link>
              </div>

              {/* Activations & strategy — the custom card IS the contact form */}
              <div id="contact" className="flex scroll-mt-16 flex-col pt-7 lg:pl-8 lg:pt-0">
                <p className="mb-3.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                  Activations &amp; strategy
                </p>
                <p className="mb-4 text-[32px] font-semibold tracking-[-0.02em]">Custom</p>
                <p className="mb-[18px] text-[13.5px] leading-[1.6] text-[color:var(--fg-muted)]">
                  Full-service commissioning or ongoing art strategy. Tell us about your
                  programme — we&rsquo;ll reply within two business days.
                </p>
                <PartnerContactForm />
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-5">
              <p className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                Featured placement (+$75 NZD) pins your listing to the top of the feed and weekly
                digest for the duration of your opportunity. Add it during setup.
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
