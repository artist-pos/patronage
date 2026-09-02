import Link from "next/link";

interface Card {
  label: string;
  headline: string;
  body: string;
  features: string[];
  cta: { text: string; href: string };
}

const CARDS: Card[] = [
  {
    label: "Artist",
    headline: "One URL for your whole practice.",
    body: "Profile, CV, studio feed, available works. Free to join.",
    features: [
      "Find grants and residencies",
      "Build a public profile and CV",
      "Share studio updates and works",
      "Be discovered by patrons and partners",
    ],
    cta: { text: "Create a free artist account", href: "/get-started" },
  },
  {
    label: "Patron",
    headline: "Support the artists you love.",
    body: "Back an artist monthly or one-off. Support goes directly to them.",
    features: [
      "Monthly or one-off support",
      "Follow studio updates and posts",
      "Discover available works",
      "Champion artists you believe in",
    ],
    cta: { text: "Become a patron", href: "/support" },
  },
  {
    label: "Partner / Funder",
    headline: "Reach the right artists.",
    body: "Post opportunities and run applications through a built-in pipeline. No more Google Forms.",
    features: [
      "Post opportunities for free",
      "Replace Google Forms with Patronage Pipeline",
      "Review and shortlist applications online",
      "Reach NZ & Australian artists",
    ],
    cta: { text: "Post an opportunity", href: "/partners" },
  },
];

/* v2 "Three roles" — feed-bg section, white containerless-adjacent cards
   (actual UI components keep a surface), mono kickers, outline mono CTAs
   that invert on hover. */
export function WhoIsPatronageFor() {
  return (
    <section className="bg-feed-bg border-t border-b border-border px-6 py-16">
      <div className="max-w-[1600px] mx-auto">
        <h2 className="text-[28px] md:text-4xl font-semibold tracking-[-0.028em] leading-[1.06] max-w-[480px] mb-12">
          One platform, three relationships.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-stretch">
          {CARDS.map((card) => (
            <div key={card.label} className="flex flex-col bg-card p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                {card.label}
              </p>

              <h3 className="mt-3.5 text-lg font-semibold tracking-[-0.018em] leading-tight">
                {card.headline}
              </h3>

              <p className="mt-2 text-sm leading-[1.65] text-[color:var(--fg-muted)]">
                {card.body}
              </p>

              <ul className="mt-4.5 flex flex-col gap-[7px] mb-6">
                {card.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-[13px] leading-relaxed text-[color:var(--fg-muted)]"
                  >
                    – {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={card.cta.href}
                className="mt-auto block w-full border border-foreground px-4 py-2.5 text-center font-mono text-xs text-foreground transition-colors hover:bg-foreground hover:text-white"
              >
                {card.cta.text}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
