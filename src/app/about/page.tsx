import Link from "next/link";
import type { Metadata } from "next";

const SITE = "https://patronage.nz";

export const metadata: Metadata = {
  title: { absolute: "About Patronage | Arts grants, residencies and open calls NZ" },
  description:
    "Patronage lists grants, residencies, commissions and open calls for artists in Aotearoa New Zealand and Australia, and helps arts organisations run and record their rounds.",
  alternates: { canonical: "/about" },
};

const LOOP = [
  "An organisation creates an opportunity.",
  "Artists apply.",
  "The work gets made.",
  "The artist’s profile and application record make the next opportunity easier.",
];

const aboutSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "AboutPage",
      "@id": `${SITE}/about#page`,
      url: `${SITE}/about`,
      name: "About Patronage",
      isPartOf: { "@id": `${SITE}/#website` },
      about: { "@id": `${SITE}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      founder: { "@id": `${SITE}/#founder` },
      areaServed: ["New Zealand", "Australia"],
      sameAs: ["https://www.instagram.com/patronage.nz/"],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "blake@patronage.nz",
        telephone: "+64 27 536 4850",
        areaServed: ["NZ", "AU"],
        availableLanguage: "English",
      },
    },
    {
      "@type": "Person",
      "@id": `${SITE}/#founder`,
      name: "Blake Aitken",
      jobTitle: "Architectural designer, artist and founder of Patronage",
      url: `${SITE}/blakeaitken`,
      sameAs: ["https://blakeaitken.com"],
      worksFor: { "@id": `${SITE}/#organization` },
    },
  ],
};

const link =
  "underline decoration-[color:var(--fg-subtle)] underline-offset-4 hover:decoration-foreground";

export default function AboutPage() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }}
      />

      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-12 pt-16 sm:px-12 lg:pt-24">
          <p className="t-section-label mb-6">About</p>
          <h1 className="t-display max-w-[760px] text-[40px] sm:text-[56px]">About Patronage</h1>
          <p className="mt-8 max-w-[680px] text-[19px] leading-[1.5] tracking-[-0.01em]">
            Patronage is a free place for artists in Aotearoa New Zealand and Australia to find
            grants, residencies, commissions and open calls, and to keep one portfolio and CV that
            works for every application. Arts organisations use it to post opportunities, take
            applications and keep a record of each round.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-12 sm:px-12">
          <h2 className="t-heading mb-5">Why Patronage exists</h2>
          <div className="t-body max-w-[640px] space-y-5 text-[color:var(--fg-muted)]">
            <p>
              Artists don&rsquo;t need another place to upload their work and wait for someone to
              buy it. They need more reasons for the work to be made.
            </p>
            <p>
              I started Patronage because I kept running into the same problem as an artist:
              finding opportunities to actually make work.
            </p>
            <p>
              I built a system to collect grants, residencies, commissions, exhibitions,
              competitions and other opportunities in one place. Then I realised the opportunity
              itself could become the reason artists build a profile. Instead of asking artists to
              join another marketplace and hope something happens, Patronage starts with the
              opportunity.
            </p>
          </div>

          <ol className="mt-12 grid max-w-[1100px] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((line, i) => (
              <li key={line} className="bg-feed-bg p-6">
                <span className="font-mono text-xs text-[color:var(--fg-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="t-heading mt-6">{line}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-16 sm:px-12"><div className="grid max-w-[1100px] gap-12 md:grid-cols-2">
          <div>
            <h2 className="t-heading mb-4">For artists</h2>
            <p className="t-body text-[color:var(--fg-muted)]">
              Build one profile and reuse it. Search{" "}
              <Link href="/opportunities/grants" className={link}>arts grants</Link>,{" "}
              <Link href="/opportunities/residencies" className={link}>residencies</Link> and{" "}
              <Link href="/opportunities/open-calls" className={link}>open calls</Link> from New
              Zealand, Australia and overseas, and apply with the details you already have.
            </p>
            <p className="mt-4 text-[14px] font-medium">
              <Link href="/opportunities" className={link}>Browse opportunities</Link>
              <span className="mx-3 text-[color:var(--fg-subtle)]">·</span>
              <Link href="/auth/signup?role=artist" className={link}>Join as an artist</Link>
            </p>
          </div>
          <div>
            <h2 className="t-heading mb-4">For organisations</h2>
            <p className="t-body text-[color:var(--fg-muted)]">
              Post a commission, residency or open call. Artists apply through your own questions,
              you move them through your own stages, and nothing is sent to applicants until you
              say so. The record stays when the round ends.
            </p>
            <p className="mt-4 text-[14px] font-medium">
              <Link href="/partners" className={link}>List an opportunity</Link>
              <span className="mx-3 text-[color:var(--fg-subtle)]">·</span>
              <Link href="/artists" className={link}>Find artists in Aotearoa</Link>
            </p>
          </div>
        </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-20 sm:px-12 lg:pb-28">
          <h2 className="t-heading mb-4">Who runs it</h2>
          <div className="t-body max-w-[640px] space-y-5 text-[color:var(--fg-muted)]">
            <p>
              Patronage is built and run independently by{" "}
              <a href="https://blakeaitken.com" target="_blank" rel="noopener noreferrer" className={link}>Blake Aitken</a>, an architectural
              designer, artist and founder of Patronage, in Aotearoa New Zealand. His{" "}
              <Link href="/blakeaitken" className={link}>Patronage profile</Link> is here too.
            </p>
            <p>
              Patronage began inside my own practice. In 2025 I placed 100 abandoned road cones in
              Te Komititanga Square in Tāmaki Makaurau Auckland, each with a QR code linking to
              patronage.nz. The work, <em>You&rsquo;ve Walked Past Me So Many Times</em>, drew 2,500
              QR conversions and coverage in Stuff and on The Breeze 93.4FM, and was included in
              The Spinoff&rsquo;s 2025 road cone retrospective.
            </p>
            <p>
              Questions, ideas or a round you would like to run: email{" "}
              <a href="mailto:blake@patronage.nz" className={link}>blake@patronage.nz</a>, call{" "}
              <a href="tel:+64275364850" className={link}>+64 27 536 4850</a>, or find us on{" "}
              <a
                href="https://www.instagram.com/patronage.nz/"
                target="_blank"
                rel="noopener noreferrer"
                className={link}
              >
                Instagram
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
