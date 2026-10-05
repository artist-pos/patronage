import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workplace Art and Hotel Art Commissioning New Zealand | Patronage",
  description:
    "Commission New Zealand artists for lobbies, restaurants and arrival spaces, or bring an artist into your organisation for a residency. Patronage finds the artist who fits your space and brief.",
  alternates: { canonical: "https://patronage.nz/partners/workplaces-and-hotels" },
  openGraph: {
    title: "Workplace Art and Hotel Art Commissioning New Zealand | Patronage",
    description:
      "Commission New Zealand artists for lobbies, restaurants and arrival spaces, or an artist residency inside your organisation.",
    url: "https://patronage.nz/partners/workplaces-and-hotels",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is the difference between commissioning artwork and buying existing work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A commission is made for your space -- the scale, the light, the material, the narrative. It belongs to the place in a way that purchased work usually does not. For arrival spaces and lobbies, that difference is felt by everyone who uses the building.",
      },
    },
    {
      "@type": "Question",
      name: "What is an artist residency inside an organisation?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An artist spends six months embedded in your team -- attending meetings, observing processes, spending time in the places your people work. At the end, they make something from what they found. It is one of the most interesting things an organisation can do for its culture.",
      },
    },
    {
      "@type": "Question",
      name: "How do you select artists for workplace and hospitality commissions?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We find the artist whose practice fits the brief, the space and the organisation. For a hospitality commission that might mean an artist known for food, landscape or material culture. For a corporate lobby it might mean an artist with a strong spatial or architectural sensibility. The selection is documented and explained.",
      },
    },
    {
      "@type": "Question",
      name: "Can we use New Zealand artwork as part of our hotel or hospitality brand?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. New Zealand art commissioned for your property can be licensed for use in brand materials, menus, signage and digital channels, with royalties back to the artist. We manage the licensing as part of the original commission.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on the scale of the commission and the space involved. Get in touch and we can work through what is right for your project.",
      },
    },
    {
      "@type": "Question",
      name: "Do you work outside Auckland?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We work across Aotearoa and draw on artists from around the country. Location affects how we approach the brief, which is usually an advantage.",
      },
    },
  ],
};

const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors bg-brand text-white hover:opacity-90";

const WHAT_YOU_GET = [
  {
    title: "Artwork made for your space",
    body: "Scale, material, light and narrative designed around the specific room, lobby or arrival sequence. Not a print selected from a catalogue, but work that belongs to the place.",
  },
  {
    title: "The right artist for the brief",
    body: "We find the New Zealand artist whose practice fits the space, the organisation and what you want the place to say. The selection is explained and documented.",
  },
  {
    title: "Artist residencies",
    body: "An artist embedded in your team for six months, attending meetings and spending time in the places your people work. At the end, they make something from what they found.",
  },
  {
    title: "Licensing for brand use",
    body: "Commissioned artwork can be licensed for menus, signage, brand materials and digital channels, with royalties back to the artist. We manage the agreement.",
  },
  {
    title: "End-to-end management",
    body: "Brief, artist selection, contract, production and installation. One contact from commission to hung work.",
  },
  {
    title: "Documentation",
    body: "Artist profile, commission rationale and final artwork files, ready for ESG, community and board reporting, or simply for the plaque on the wall.",
  },
];

export default function WorkplacesAndHotelsPage() {
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
              / Workplaces &amp; hotels
            </p>
            <h1 className="t-display max-w-[820px] text-[40px] sm:text-[56px]">
              Workplace art and hotel art commissioning in New Zealand.
            </h1>
            <div className="mt-8 max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                Commission New Zealand artists for lobbies, restaurants and arrival spaces, or
                bring an artist inside your organisation for a residency.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                We find the artist whose practice fits the brief, the space and the organisation.
                The commission is made for your building, not selected from a catalogue. For
                arrival spaces and lobbies, that difference is felt by everyone who uses the
                building.
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
              Art that belongs to the place.
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
              Tell us about the space.
            </h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              A lobby, a restaurant wall, a corridor, or a residency brief. Blake replies within
              two business days.
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
