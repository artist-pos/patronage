import Link from "next/link";
import type { Metadata } from "next";

// DRAFT — Blake to rewrite in his own voice before this is linked or indexed.
// Kept out of search and unlinked until then.
export const metadata: Metadata = {
  title: "Why Patronage exists",
  description: "Why Patronage exists: more reasons for creative work to be made, and a network built around it.",
  robots: { index: false, follow: false },
};

const LOOP = [
  "An organisation creates an opportunity.",
  "Artists apply.",
  "The work gets made.",
  "The artist’s profile and application record make the next opportunity easier.",
];

export default function AboutPage() {
  return (
    <div>
      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-16 pt-16 sm:px-12 lg:pt-24">
          <p className="t-section-label mb-6">About</p>
          <h1 className="t-display max-w-[760px] text-[40px] sm:text-[56px]">Why Patronage exists</h1>
          <p className="mt-8 max-w-[640px] text-[19px] leading-[1.5] tracking-[-0.01em]">
            Artists don&rsquo;t need another place to upload their work and wait for someone to buy
            it. They need more reasons for the work to be made.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1600px] px-6 pb-20 sm:px-12 lg:pb-28">
          <div className="t-body max-w-[640px] space-y-5 text-[color:var(--fg-muted)]">
            <p>
              I started Patronage because I kept running into the same problem as an artist:
              finding opportunities to actually make work.
            </p>
            <p>
              I built a system to collect grants, residencies, commissions, exhibitions,
              competitions and other opportunities in one place. Then I realised the opportunity
              itself could become the reason artists build a profile.
            </p>
            <p>
              Instead of asking artists to join another marketplace and hope something happens,
              Patronage starts with the opportunity.
            </p>
          </div>

          <ol className="mt-12 grid max-w-[1100px] grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {LOOP.map((line, i) => (
              <li key={line} className="bg-feed-bg p-6">
                <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="t-heading mt-6">{line}</p>
              </li>
            ))}
          </ol>

          <div className="t-body mt-12 max-w-[640px] space-y-5 text-[color:var(--fg-muted)]">
            <p>
              From there, the network grows around the work: commissioning, exhibitions, sales,
              collections and new opportunities. Artists, organisations and the people who support
              them, in the same place.
            </p>
            <p className="text-foreground">A more connected arts ecosystem. That is what Patronage is building.</p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] font-medium">
            <Link href="/opportunities" className="underline decoration-[color:var(--fg-subtle)] underline-offset-4 hover:decoration-foreground">
              Find an opportunity
            </Link>
            <Link href="/artists" className="underline decoration-[color:var(--fg-subtle)] underline-offset-4 hover:decoration-foreground">
              Find an artist
            </Link>
            <Link href="/partners" className="underline decoration-[color:var(--fg-subtle)] underline-offset-4 hover:decoration-foreground">
              Create an opportunity
            </Link>
            <Link href="/blakeaitken" className="text-[color:var(--fg-muted)] underline decoration-[color:var(--fg-subtle)] underline-offset-4 hover:text-foreground">
              Blake Aitken, architectural designer, artist and founder
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
