import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public Art Strategy New Zealand | Art Consultant for Developers | Patronage",
  description:
    "Patronage provides public art strategy for developers, councils and masterplan teams across Aotearoa. We map what art can do across your project before anyone talks about murals.",
  alternates: { canonical: "https://patronage.nz/partners/art-strategy" },
  openGraph: {
    title: "Public Art Strategy New Zealand | Art Consultant for Developers | Patronage",
    description:
      "Public art strategy for developers, councils and masterplan teams. We map what art can do across your project, consent documents and programme before anyone talks about murals.",
    url: "https://patronage.nz/partners/art-strategy",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "When in a project should we bring in an art strategy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "As early as possible -- ideally at the consent or design stage, before budgets are locked and before surfaces are allocated to other uses. The earlier we look, the more options are available and the better the art serves the project.",
      },
    },
    {
      "@type": "Question",
      name: "What does an art strategy actually produce?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A clear map of where art can create value across the project: which surfaces, which stages, what kind of art, what budget is reasonable and what outcomes to report against. It gives your team something to act on rather than a vision document.",
      },
    },
    {
      "@type": "Question",
      name: "Do you work with the design team?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We read consent documents, design reports and masterplans and work alongside architects, landscape architects and planners. Art strategy that is written in isolation from the design team usually does not survive to delivery.",
      },
    },
    {
      "@type": "Question",
      name: "Can art strategy support a consent application?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. An art strategy prepared before consent can demonstrate community benefit, urban design contribution and cultural responsiveness, all of which can support a consent application or address conditions.",
      },
    },
    {
      "@type": "Question",
      name: "Do you commission the art as well?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. A strategy is most useful when the same team carries it through to commissioning. We can manage the full process from brief to installed work, or hand off a briefing pack to your team at any stage.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on the scale of the project and the depth of the strategy. Get in touch with a sense of the project and we can scope something appropriate.",
      },
    },
  ],
};

const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors bg-brand text-white hover:opacity-90";

const WHAT_YOU_GET = [
  {
    title: "A creative audit of your project",
    body: "We read your consent documents, design reports and masterplan and map where art can add value: which surfaces, which stages, what kind of work and what the brief should be.",
  },
  {
    title: "What is funded and what is required",
    body: "We identify any consent conditions, section 106 obligations or funding opportunities that apply, so the strategy starts from what is already in motion.",
  },
  {
    title: "The right artists, not the available ones",
    body: "We find the artists whose practice fits the brief, the place and your team. The selection is explained and documented, not just presented.",
  },
  {
    title: "A strategy your team can act on",
    body: "Not a vision document. A clear map of surfaces, stages, budgets and outcomes, ready to take into the design team, the consent process or the board.",
  },
  {
    title: "Commissioning and delivery",
    body: "We carry the strategy through to commissioned and installed work, or hand off a briefing pack at any stage. The same team that wrote the strategy manages the commissions.",
  },
  {
    title: "Reporting and documentation",
    body: "Every commission is documented through the platform, from selection rationale to finished work, ready for ESG, community and board reporting.",
  },
];

export default function ArtStrategyPage() {
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
              / Art strategy
            </p>
            <h1 className="t-display max-w-[820px] text-[40px] sm:text-[56px]">
              Public art strategy for New Zealand developers and masterplan teams.
            </h1>
            <div className="mt-8 max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                Not art for art&rsquo;s sake. We work out how art can add to your project&rsquo;s
                values, amenity and positioning, and to the experience of the people who live and
                work there.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                Before anyone talks about murals or sculpture, we ask what the place needs: who
                uses it, what it should say and how it should feel. We read your consent documents,
                design reports and masterplan and map where art can create value across the whole
                project. The brief comes from your goals, so the art serves them.
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
              Art that serves the project.
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
              Tell us about the project.
            </h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              A site, a masterplan, a consent condition or just a question about where art belongs
              in what you are building. Blake replies within two business days.
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
