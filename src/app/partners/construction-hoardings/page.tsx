import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Construction Hoarding Artwork New Zealand | Patronage",
  description:
    "Commission a New Zealand artist to design artwork for your construction hoarding. Patronage finds the artist who fits your site, brief and team, and manages the commission from brief to delivery.",
  alternates: { canonical: "https://patronage.nz/partners/construction-hoardings" },
  openGraph: {
    title: "Construction Hoarding Artwork New Zealand | Patronage",
    description:
      "Commission a New Zealand artist to design artwork for your construction hoarding. We find the right artist for your site and manage the commission end to end.",
    url: "https://patronage.nz/partners/construction-hoardings",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How long does a hoarding commission take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "From brief to finished artwork, most hoarding commissions take four to eight weeks depending on the scale and the complexity of the site. We can move faster for urgent programmes.",
      },
    },
    {
      "@type": "Question",
      name: "Can we use the artwork after the hoarding comes down?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Commissioned artwork can be licensed onto future hoardings, boardrooms or other surfaces at a fraction of the cost of a new commission, with royalties back to the artist. We manage the licensing agreement as part of the original commission.",
      },
    },
    {
      "@type": "Question",
      name: "Do we need to find the artist ourselves?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Finding the artist is what we do. We draw on a network of New Zealand artists across painting, illustration, photography and mixed media, and we find the one whose practice and sensibility fit your site and brief.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on the scale, the number of panels and the scope of the brief. Get in touch and we can work through what is right for your site.",
      },
    },
    {
      "@type": "Question",
      name: "Does commissioned artwork reduce graffiti?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "In our experience, yes. Artwork that clearly belongs to a place is much less likely to be tagged than a blank or branded panel. An anti-graffiti coating is also standard on all hoarding commissions we manage.",
      },
    },
  ],
};

const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors bg-brand text-white hover:opacity-90";

const WHAT_YOU_GET = [
  {
    title: "A brief built around your site",
    body: "Panel sizes, sightlines, timeframes and the story of what is being built. We write the brief from your project, not from a template.",
  },
  {
    title: "The right artist, not the nearest one",
    body: "We find the New Zealand artist whose practice and sensibility fit the brief, the neighbourhood and your team. The selection is explained, not just presented.",
  },
  {
    title: "Anti-graffiti coating as standard",
    body: "Artwork treated as infrastructure rather than decoration. The coating is specified into the production brief from day one.",
  },
  {
    title: "Licensing for future surfaces",
    body: "Commissioned artwork can be licensed onto future hoardings or other surfaces at a fraction of the cost of a new commission, with royalties back to the artist. We manage the agreement.",
  },
  {
    title: "End-to-end management",
    body: "Brief, artist selection, contract, production files and installation sign-off. One contact from start to finish.",
  },
  {
    title: "Documentation for your team",
    body: "Artist profile, commission rationale and final artwork files, ready for community, consent or ESG reporting.",
  },
];

export default function ConstructionHoardingsPage() {
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
              / Construction hoardings
            </p>
            <h1 className="t-display max-w-[820px] text-[40px] sm:text-[56px]">
              Construction hoarding artwork for New Zealand building sites.
            </h1>
            <div className="mt-8 max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                A well-designed hoarding turns a building site into something worth looking at.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                We find the New Zealand artist whose practice fits the site, the neighbourhood and
                the story of what is being built, then commission them to design artwork that works
                at scale. The result softens the site impact, reduces graffiti and gives the street
                something worth seeing while you build.
              </p>
              <p className="t-body mt-3 text-[color:var(--fg-muted)]">
                Commissioned artwork can be licensed onto future surfaces at a fraction of the cost
                of a new commission, with royalties back to the artist.
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
              From brief to installed artwork.
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {WHAT_YOU_GET.map((item, i) => (
                <div key={item.title} className="flex flex-col bg-white p-6">
                  <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
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
              Tell us about the site.
            </h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              Panel sizes, location, timeframe, or just a question about whether it is worth
              commissioning. Blake replies within two business days.
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
