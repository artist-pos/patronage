import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PARTNER_CONFIGS } from "@/lib/partner-configs";
import { TrancheCalculator } from "@/components/partners/TrancheCalculator";
import { PartnerPdfViewerClient } from "@/components/partners/PartnerPdfViewerClient";
import { PartnerSideNav } from "@/components/partners/PartnerSideNav";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const config = PARTNER_CONFIGS[slug.toUpperCase()];
  if (!config) return {};
  return {
    title: `${config.eyebrow} — Patronage`,
    description: config.subtitle,
    robots: { index: false, follow: false },
  };
}

export default async function PartnerProposalPage({ params }: Props) {
  const { slug } = await params;
  const config = PARTNER_CONFIGS[slug.toUpperCase()];
  if (!config) notFound();

  return (
    <>
      <PartnerSideNav />

      <div className="max-w-[1280px] mx-auto px-6 py-12 space-y-16">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="space-y-4 pb-12 border-b border-border">
          <p
            className="font-mono text-xs uppercase tracking-[0.14em]"
            style={{ color: config.accent }}
          >
            {config.eyebrow}
          </p>
          <h1 className="text-4xl md:text-5xl font-light leading-[1.05] tracking-tight max-w-[14ch]">
            {config.title}
          </h1>
          <p className="text-base text-muted-foreground max-w-[44ch] leading-relaxed">
            {config.subtitle}
          </p>
        </section>

        {/* ── PDF Viewer ─────────────────────────────────────────────────── */}
        <section id="proposal" className="space-y-4 pb-12 border-b border-border">
          <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
            Programme proposal
          </p>
          <PartnerPdfViewerClient pdfUrl={config.pdfUrl} />
        </section>

        {/* ── Tranche Calculator ─────────────────────────────────────────── */}
        <section id="calculator" className="space-y-5 pb-12 border-b border-border">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-widest text-stone-400">
              Tranche calculator
            </p>
            <h2 className="text-2xl font-light tracking-tight">
              Model your first tranche.
            </h2>
            <p className="text-sm text-muted-foreground">
              {config.calculatorIntro}
            </p>
          </div>
          <TrancheCalculator tiers={config.tiers} defaultQtys={config.defaultQtys} />
        </section>

        {/* ── Footer CTA ─────────────────────────────────────────────────── */}
        <section id="explore" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-light tracking-tight">Explore the platform.</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Browse artist profiles, documented projects, and the open-call infrastructure.
              </p>
            </div>
            <Link
              href="https://patronage.nz"
              className="shrink-0 inline-flex items-center gap-2 bg-black text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-stone-800 transition-colors"
            >
              Visit patronage.nz →
            </Link>
          </div>

          <div className="flex justify-between font-mono text-xs text-stone-400 pt-4 border-t border-border">
            <span>Patronage · 2026</span>
            <span>Blake Aitken · 027 536 4850</span>
          </div>
        </section>
      </div>
    </>
  );
}
