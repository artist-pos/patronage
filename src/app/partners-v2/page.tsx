import Link from "next/link";
import type { Metadata } from "next";
import { PartnerContactForm } from "@/components/partners/PartnerContactForm";
import { getCachedHomeData } from "@/lib/home-data";
import { getServerUser } from "@/lib/supabase/get-server-user";

// Hidden preview of a service-first partners page: it opens on what art can do
// for a place or organisation, with the consultancy and commissioning work up
// front and the self-serve software below it. Excluded from search and the
// sitemap.
export const metadata: Metadata = {
  title: "Partners v2 (preview)",
  robots: { index: false, follow: false },
};

const BTN =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors";
const BTN_PRIMARY = `${BTN} bg-brand text-white hover:opacity-90`;
const BTN_OUTLINE = `${BTN} border border-foreground text-foreground hover:bg-foreground/5`;
const TEXT_LINK =
  "inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-foreground underline decoration-[color:var(--fg-subtle)] underline-offset-4 transition-colors hover:decoration-foreground";

const PROCESS = ["Site", "Strategy", "Brief", "Opportunity", "Artists", "Commissioning", "Delivery"];

const SERVICES = [
  {
    title: "Art strategy",
    body: "Identify where art can contribute to a development, place, organisation or programme.",
  },
  {
    title: "Commissioning",
    body: "Develop the brief, find artists, curate proposals and manage the commissioning process.",
  },
  {
    title: "Opportunities",
    body: "Publish an open call, funding round, residency, exhibition or commission through Patronage.",
  },
  {
    title: "Surface projects",
    body: "Use existing surfaces and budgets to introduce artwork into public-facing environments.",
  },
];

const PLATFORM = [
  ["Applications", "Artists apply with their profile, CV and work attached. Add your own questions."],
  ["Review", "Shortlist, score and select as a panel, on a board or in a table."],
  ["Notify", "Staged messages to selected and unsuccessful applicants."],
  ["Deliver", "Collect production files from selected artists, with secure download links."],
  ["Report", "Six- and twelve-month follow-ups, exportable for your board."],
];

export default async function PartnersV2() {
  const today = new Date().toISOString().split("T")[0];
  const [{ user }, { oppCount, artistCount, partnerCount }] = await Promise.all([
    getServerUser(),
    getCachedHomeData(today),
  ]);
  const pipelineHref = user ? "/partner/opportunities/new?type=pipeline" : "/auth/signup?intent=partner";

  const stats: [string, string][] = [
    [`${artistCount}`, "artists"],
    [`${oppCount}+`, "open opportunities"],
    ...(partnerCount > 0 ? ([[`${partnerCount}`, "organisations"]] as [string, string][]) : []),
  ];

  return (
    <div>
      {/* ══ HERO — the question the page answers ══ */}
      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-20 pt-16 sm:px-12 lg:pb-28 lg:pt-24">
          <p className="t-section-label mb-6">For organisations</p>
          <h1 className="t-display max-w-[820px] text-[40px] sm:text-[60px]">What should art do here?</h1>
          <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-20">
            <div className="max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                Patronage works with organisations to identify, develop and deliver creative
                opportunities.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                A project might need a stronger identity, a sense of place, better public
                engagement, resident connection, or simply a reason for people to spend time
                somewhere. We start with the place and the project, then work out where art can
                create value.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
                <a href="#contact" className={BTN_PRIMARY}>
                  Talk to Blake <span aria-hidden>→</span>
                </a>
                <a href="#platform" className={TEXT_LINK}>
                  Run an opportunity yourself
                </a>
              </div>
            </div>
            {/* The network the work draws on — real counts, not claims. */}
            <dl className="flex flex-wrap gap-x-12 gap-y-6 self-end">
              {stats.map(([n, label]) => (
                <div key={label}>
                  <dt className="font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">{n}</dt>
                  <dd className="mt-2 text-[13px] text-[color:var(--fg-muted)]">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ══ PROCESS — site to delivery, one line ══ */}
      <section className="bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-6 py-10 sm:px-12">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-3">
            {PROCESS.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[15px] font-medium tracking-[-0.01em]">{step}</span>
                </span>
                {i < PROCESS.length - 1 && (
                  <span aria-hidden className="text-[color:var(--fg-subtle)]">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ WORK WITH US — four services as white tiles on the feed surface ══ */}
      <section className="bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-6 pb-20 pt-10 sm:px-12 lg:pb-28">
          <p className="t-section-label mb-3">Work with us</p>
          <h2 className="t-display max-w-[640px] text-[36px] sm:text-[44px]">From the first question to the finished work.</h2>
          <div className="mt-12 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <div key={s.title} className="flex flex-col bg-white p-6">
                <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="t-heading mt-6">{s.title}</h3>
                <p className="t-body-sm mt-2">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ RECENT WORK — what this looks like in practice ══ */}
      <section>
        <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
          <p className="t-section-label mb-3">Recent work</p>
          <h2 className="t-display max-w-[640px] text-[36px] sm:text-[44px]">In practice.</h2>
          <div className="mt-12 grid grid-cols-1 gap-x-20 gap-y-14 lg:grid-cols-2">
            <article>
              <p className="text-[13px] font-medium text-[color:var(--fg-muted)]">
                Commissioning · Bridge Housing Charitable Trust
              </p>
              <h3 className="t-heading mt-3">A utility box mural for an affordable housing development.</h3>
              <p className="t-body-sm mt-2 max-w-[520px]">
                An open call for artists to paint an 11m² utility box at Peake Mews in Cambridge,
                Waikato, for the residents and children who live around it. A $3,000 all-inclusive
                artist fee, a box template and a brief, with applications run through Patronage.
              </p>
              <Link
                href="/opportunities/bridge-housing-charitable-trust-utility-box-mural-cambridge-2026"
                className={`${TEXT_LINK} mt-2`}
              >
                See the open call <span aria-hidden>→</span>
              </Link>
            </article>
            <article>
              <p className="text-[13px] font-medium text-[color:var(--fg-muted)]">
                Art strategy · An electricity distribution business
              </p>
              <h3 className="t-heading mt-3">A first tranche of 30 boxes across a network of ~300.</h3>
              <p className="t-body-sm mt-2 max-w-[520px]">
                A programme aimed at the highest-traffic corners of its street-level assets: artist
                fees set by panel size, an anti-graffiti coating treated as asset management, QR
                plates for condition reporting, and optional artist print sales. Proposal under
                review.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ══ PLATFORM — the software, where it belongs: in support of the work ══ */}
      <section id="platform" className="scroll-mt-16 bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
          <p className="t-section-label mb-3">Pipeline · Run it through Patronage</p>
          <h2 className="t-display max-w-[640px] text-[36px] sm:text-[44px]">One place for the whole opportunity.</h2>
          <p className="t-body mt-4 max-w-[560px] text-[color:var(--fg-muted)]">
            Pipeline is how you run an opportunity on Patronage. Manage applications, artists and
            project information in one place, instead of forms, spreadsheets and email chains.
          </p>

          <ol className="mt-12 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {PLATFORM.map(([title, body], i) => (
              <li key={title} className="bg-white p-6">
                <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="t-heading mt-6">{title}</h3>
                <p className="t-body-sm mt-2">{body}</p>
              </li>
            ))}
          </ol>

          {/* Pricing, stated plainly: two self-serve options. */}
          <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="flex flex-col bg-white p-6 sm:p-8">
              <p className="text-[13px] font-medium text-[color:var(--fg-muted)]">List an opportunity</p>
              <p className="mt-3 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">Free</p>
              <p className="t-body-sm mt-4 max-w-[440px] flex-1">
                Your opportunity in the listings, search and the weekly email to artists, with
                applications going wherever you already take them. Reviewed within two business
                days.
              </p>
              <div className="mt-8">
                <Link href="/partner/list-free" className={BTN_OUTLINE}>
                  List an opportunity <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
            <div className="flex flex-col bg-white p-6 sm:p-8">
              <p className="text-[13px] font-medium text-[color:var(--fg-muted)]">Pipeline: run applications through Patronage</p>
              <p className="mt-3 font-mono text-[28px] font-semibold leading-none tracking-[-0.02em]">
                Free first round
              </p>
              <p className="mt-2 font-mono text-[12px] text-[color:var(--fg-muted)]">then $200 NZD per round, plus card fee</p>
              <p className="t-body-sm mt-4 max-w-[440px] flex-1">
                Everything in a listing, plus applications, panel review, notifications, file
                delivery and follow-up reporting.
              </p>
              <div className="mt-8">
                <Link href={pipelineHref} className={BTN_PRIMARY}>
                  Set up an opportunity <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CONTACT — a person, not a sales inbox ══ */}
      <section id="contact" className="scroll-mt-16">
        <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-12 px-6 py-20 sm:px-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-20 lg:py-28">
          <div>
            <p className="t-section-label mb-3">Talk to Blake</p>
            <h2 className="t-display max-w-[560px] text-[36px] sm:text-[44px]">Tell us about the place or the project.</h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              A site, a programme, a budget, or just a question about whether art belongs there.
              Blake is an architectural designer, artist and the founder of Patronage, and replies
              within two business days.
            </p>
            <Link href="/blakeaitken" className={`${TEXT_LINK} mt-2`}>
              Blake&rsquo;s profile <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="bg-feed-bg p-6 sm:p-8">
            <PartnerContactForm />
          </div>
        </div>
      </section>
    </div>
  );
}
