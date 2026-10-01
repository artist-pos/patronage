import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Utility Box Artwork New Zealand | Streetscape Art Programmes | Patronage",
  description:
    "Commissioned artwork with an anti-graffiti coating turns a maintenance problem into a streetscape asset. Patronage runs utility box art programmes from ten boxes to hundreds across Aotearoa.",
  alternates: { canonical: "https://patronage.nz/partners/utility-boxes" },
  openGraph: {
    title: "Utility Box Artwork New Zealand | Streetscape Art Programmes | Patronage",
    description:
      "Commissioned artwork with an anti-graffiti coating turns a maintenance problem into a streetscape asset. Programmes from ten boxes to hundreds.",
    url: "https://patronage.nz/partners/utility-boxes",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do you select artists for a utility box programme?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We find the artist who best fits the brief, the location and the character of the neighbourhood. For larger programmes, we may use multiple artists across different zones. The selection rationale is documented for your records.",
      },
    },
    {
      "@type": "Question",
      name: "Does the anti-graffiti coating work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We specify a sacrificial coating that allows graffiti to be removed without damaging the artwork. Tagged boxes can be cleaned and recoated as part of routine asset maintenance.",
      },
    },
    {
      "@type": "Question",
      name: "Can you run a programme across a large network of boxes?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We have experience structuring programmes across networks of hundreds of boxes, with artist fees set by panel size, phased delivery and optional QR plates for condition reporting.",
      },
    },
    {
      "@type": "Question",
      name: "Who owns the artwork?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The commissioning organisation owns the right to display the artwork on the specified boxes for the agreed term. The artist retains copyright. Licensing for future surfaces or reproductions is agreed as part of the original commission.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Artist fees are typically set by panel size, with a programme management fee on top. For a first conversation about scope and budget, get in touch.",
      },
    },
    {
      "@type": "Question",
      name: "Can we add print sales to a utility box programme?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. For programmes where community engagement is a goal, we can set up limited-edition print sales for each commissioned artwork, with proceeds split between artist and a nominated community fund.",
      },
    },
  ],
};

const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors bg-brand text-white hover:opacity-90";

const WHAT_YOU_GET = [
  {
    title: "Artwork that belongs to the street",
    body: "We find the artist whose practice fits the neighbourhood, the infrastructure and the brief. Not a generic pattern, not a logo. Artwork that looks like it was made for that corner.",
  },
  {
    title: "Anti-graffiti coating as asset management",
    body: "A sacrificial coating specified into every commission. Tagged boxes can be cleaned and recoated as part of routine maintenance. The coating is treated as infrastructure, not decoration.",
  },
  {
    title: "Programmes from ten boxes to hundreds",
    body: "We structure programmes at any scale, with phased delivery, artist fees set by panel size and consistent documentation across the network.",
  },
  {
    title: "QR plates for condition reporting",
    body: "Optional QR plates allow field staff or the public to log condition issues directly to your asset management system.",
  },
  {
    title: "Optional print sales",
    body: "For programmes where community engagement is a goal, limited-edition prints of each commissioned artwork can be made available, with proceeds back to the artist.",
  },
  {
    title: "Documentation for reporting",
    body: "Artist profiles, commission rationale and final artwork files, ready for community, consent, ESG or board reporting.",
  },
];

export default function UtilityBoxesPage() {
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
              / Utility boxes
            </p>
            <h1 className="t-display max-w-[820px] text-[40px] sm:text-[56px]">
              Utility box artwork programmes across Aotearoa New Zealand.
            </h1>
            <div className="mt-8 max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                Commissioned artwork with an anti-graffiti coating turns a maintenance problem into
                a streetscape asset.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                We find the New Zealand artist whose practice fits the neighbourhood and the
                infrastructure, commission them to design artwork at scale, and treat the
                anti-graffiti coating as an asset management decision rather than an afterthought.
                Programmes from ten boxes to hundreds.
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
              An asset management decision and a streetscape improvement.
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
              Tell us about the network.
            </h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              How many boxes, where they are and what the programme needs to achieve. Blake replies
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
