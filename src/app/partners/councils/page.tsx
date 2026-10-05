import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public Art Commissioning for New Zealand Councils | Patronage",
  description:
    "Open, fair commissioning for New Zealand councils. Bus shelters, laneways, utility boxes and town centre surfaces, with clear briefs, visible budgets and complete artist records.",
  alternates: { canonical: "https://patronage.nz/partners/councils" },
  openGraph: {
    title: "Public Art Commissioning for New Zealand Councils | Patronage",
    description:
      "Open, fair commissioning for New Zealand councils. Clear briefs, visible budgets and complete artist records across any surface.",
    url: "https://patronage.nz/partners/councils",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do you make the process open and fair?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every brief goes out as an open call to artists across Aotearoa, published on Patronage with a visible budget and clear selection criteria. You shortlist and select from complete career records, portfolios and past commissions, with the rationale documented for your records.",
      },
    },
    {
      "@type": "Question",
      name: "Can you work with our council's existing procurement policy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We are familiar with the procurement requirements that apply to council spending and can structure the process to meet them, including documentation, panel composition and notification requirements.",
      },
    },
    {
      "@type": "Question",
      name: "What surfaces do you work with for councils?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bus shelters, laneways, utility boxes, town centre walls, retaining structures, pedestrian underpasses and stormwater infrastructure. If there is a surface, there is usually a brief to be written for it.",
      },
    },
    {
      "@type": "Question",
      name: "How do you handle Te Tiriti obligations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We raise this at the brief-writing stage. Where a commission sits in a place with cultural significance, we recommend engagement with the relevant iwi as part of the brief process, and we can facilitate that conversation.",
      },
    },
    {
      "@type": "Question",
      name: "Can Patronage manage the application process for our own open calls?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Our open call tools manage applications, panel review, notifications and file delivery for any arts opportunity -- council or otherwise. Many councils run their own open calls through Patronage.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on the scope, the number of commissions and the level of management required. Get in touch and we can work through what is right for your programme.",
      },
    },
  ],
};

const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors bg-brand text-white hover:opacity-90";

const WHAT_YOU_GET = [
  {
    title: "Open, documented commissioning",
    body: "Every brief is an open call. Artists across Aotearoa apply with their full profile, CV and portfolio. The selection is explained and documented.",
  },
  {
    title: "Clear briefs and visible budgets",
    body: "We write briefs that give artists what they need to decide whether to apply and what to propose. Budget is visible. Criteria are stated.",
  },
  {
    title: "Panel review, your way",
    body: "Shortlist, score and select as a panel, on a board or in a table. Add your own panel members. Stage notifications to selected and unsuccessful applicants.",
  },
  {
    title: "Complete artist records",
    body: "Every applicant's profile, exhibition history, past commissions and CV are on file. The record is there for OIA requests, annual reports and future reference.",
  },
  {
    title: "Te Tiriti consideration built in",
    body: "Where a commission sits in a place with cultural significance, we raise iwi engagement at the brief stage and can facilitate that conversation.",
  },
  {
    title: "Procurement-ready documentation",
    body: "Process records, rationale, contracts and reporting, structured to meet council procurement requirements.",
  },
];

export default function CouncilsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div>
        {/* HERO */}
        <section>
          <div className="mx-auto max-w-[1600px] px-6 pb-20 pt-16 sm:px-12 lg:pb-28 lg:pt-24">
            <p className="t-section-label mb-6">
              <Link href="/partners" className="hover:underline">
                Work with us
              </Link>{" "}
              / Councils
            </p>
            <h1 className="t-display max-w-[820px] text-[40px] sm:text-[56px]">
              Public art commissioning for New Zealand councils.
            </h1>
            <div className="mt-8 max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                Open, fair commissioning for bus shelters, laneways, utility boxes and town centre
                surfaces.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                We write clear briefs, publish them as open calls, and manage the application
                process from receipt to selection. Artists apply with complete career records.
                Selection is documented. The rationale is there for annual reports, OIA requests
                and the next time the question comes up at the council table.
              </p>
              <div className="mt-9">
                <a href="/partners#contact" className={BTN_PRIMARY}>
                  Talk to Blake <span aria-hidden>→</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* WHAT YOU GET */}
        <section className="bg-feed-bg">
          <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
            <p className="t-section-label mb-3">What you get</p>
            <h2 className="t-display max-w-[560px] text-[32px] sm:text-[40px]">
              A process your team and the public can stand behind.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {WHAT_YOU_GET.map((item, i) => (
                <div key={item.title} className="flex flex-col bg-white p-6">
                  <span className="font-mono text-xs text-[color:var(--fg-subtle)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="t-heading mt-6">{item.title}</h3>
                  <p className="t-body-sm mt-2 flex-1">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
            <p className="t-section-label mb-3">Common questions</p>
            <h2 className="t-display max-w-[560px] text-[32px] sm:text-[40px]">
              What to expect.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-0 sm:grid-cols-2">
              {faqSchema.mainEntity.map((item) => (
                <div
                  key={item.name}
                  className="border-t border-border py-5 sm:py-6 sm:pr-10"
                >
                  <h3 className="t-heading">{item.name}</h3>
                  <p className="t-body-sm mt-2 max-w-[440px] text-[color:var(--fg-muted)]">
                    {item.acceptedAnswer.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTACT CTA */}
        <section className="bg-feed-bg">
          <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
            <p className="t-section-label mb-3">Get started</p>
            <h2 className="t-display max-w-[560px] text-[32px] sm:text-[40px]">
              Tell us about the programme.
            </h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              A surface, a budget, a procurement question or a long-term programme. Blake replies
              within two business days.
            </p>
            <div className="mt-8">
              <a href="/partners#contact" className={BTN_PRIMARY}>
                Talk to Blake <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
