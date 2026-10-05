import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vacant Shopfront Art Installations New Zealand | Patronage",
  description:
    "Artist-designed window vinyl with a QR code to the live listing. Patronage makes empty tenancies better for the street and easier to lease.",
  alternates: { canonical: "https://patronage.nz/partners/vacant-shopfronts" },
  openGraph: {
    title: "Vacant Shopfront Art Installations New Zealand | Patronage",
    description:
      "Artist-designed window vinyl with a QR code to the live listing. Empty tenancies that work for the street while you find a tenant.",
    url: "https://patronage.nz/partners/vacant-shopfronts",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does the QR code work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The QR code printed on the vinyl links to your live tenancy listing. When a tenant is found, the code can be redirected to the artist's profile or removed entirely. It stays useful while the tenancy is on the market.",
      },
    },
    {
      "@type": "Question",
      name: "Can we use the same artwork across multiple shopfronts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Once artwork is commissioned, it can be licensed across multiple windows or locations in your portfolio at a fraction of the original cost. We manage the licensing with the artist.",
      },
    },
    {
      "@type": "Question",
      name: "Do we need exact window measurements before contacting you?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not for the first conversation. Approximate dimensions and a location are enough to start. We will ask for precise measurements before briefing the artist.",
      },
    },
    {
      "@type": "Question",
      name: "What kind of artists do you work with for shopfronts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Artists whose work translates well to large-format print and vinyl: illustrators, painters and graphic artists whose practice has a strong visual language at scale. We find the artist who fits the feel of the street and the building.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It depends on the number of windows and the scope of the commission. Get in touch and we can work through what makes sense for your portfolio.",
      },
    },
  ],
};

const BTN_PRIMARY =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors bg-brand text-white hover:opacity-90";

const WHAT_YOU_GET = [
  {
    title: "Artist-designed window vinyl",
    body: "Artwork made for the specific window, building and street. Not a stock print, not a sponsor billboard -- artwork that belongs to the place.",
  },
  {
    title: "QR code to your live listing",
    body: "Every installation includes a QR code printed on the vinyl. Passers-by scan to see the tenancy. The code updates when the status changes.",
  },
  {
    title: "The right artist for the street",
    body: "We find the artist whose practice fits the building's character, the neighbourhood's feel and your brief. The selection is explained, not just sent.",
  },
  {
    title: "Easier to lease",
    body: "A shopfront with artwork is easier to photograph, easier to describe and easier to show. It signals that someone is looking after the building.",
  },
  {
    title: "Licensing across your portfolio",
    body: "Commissioned artwork can be licensed across multiple windows in your portfolio at a fraction of the original cost, with royalties back to the artist.",
  },
  {
    title: "End-to-end management",
    body: "Brief, artist selection, production files and print-ready artwork. One contact from commission to installed vinyl.",
  },
];

export default function VacantShopfrontsPage() {
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
              / Vacant shopfronts
            </p>
            <h1 className="t-display max-w-[820px] text-[40px] sm:text-[56px]">
              Vacant shopfront art for New Zealand property owners and agents.
            </h1>
            <div className="mt-8 max-w-[600px]">
              <p className="text-[19px] leading-[1.5] tracking-[-0.01em] text-foreground">
                Artist-designed window vinyl with a QR code to the live listing.
              </p>
              <p className="t-body mt-5 text-[color:var(--fg-muted)]">
                An empty shopfront is a problem for the street and a harder tenancy to lease. We
                commission a New Zealand artist to design artwork for the window, with a QR code
                that links passers-by to your listing. The tenancy stays on the market; the street
                gets something worth looking at.
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
              A shopfront that works while it waits.
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
              Tell us about the tenancy.
            </h2>
            <p className="t-body mt-4 max-w-[520px] text-[color:var(--fg-muted)]">
              Location, approximate window size and how long it has been vacant. Blake replies
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
