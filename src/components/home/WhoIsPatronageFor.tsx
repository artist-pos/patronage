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
    body: "Build a public presence, share your process, and get matched with real opportunities.",
    features: [
      "Find matched grants and residencies",
      "Build your portfolio",
      "Share studio updates and works",
      "Get discovered by patrons and partners",
    ],
    cta: { text: "Join as an artist", href: "/auth/signup?role=artist" },
  },
  {
    label: "Partner / Organisation",
    headline: "Reach your artists.",
    body: "List for free, get seen with analytics, and manage applications through Patronage Pipeline — every applicant arrives with their full profile attached.",
    features: [
      "List opportunities for free",
      "Get seen with built-in analytics",
      "Manage applications with Patronage Pipeline",
      "Applicants arrive with profile, works and history attached",
    ],
    cta: { text: "List an opportunity", href: "/list-an-opportunity" },
  },
  {
    label: "Patron",
    headline: "Support the artists you love.",
    body: "Follow artists’ process, discover new work, and back the ones you believe in.",
    features: [
      "Discover artists you connect with",
      "Follow their studio updates",
      "Support monthly or one-off",
      "Browse and collect available works",
    ],
    cta: { text: "Become a patron", href: "/support" },
  },
];

/* v2 "Three roles" — same cream card language as the hero, white bordered
   cards, solid brand-green CTAs that lighten to the hero chips' hover tint. */
export function WhoIsPatronageFor() {
  return (
    <section className="border-t border-b border-border bg-[#E3DFDA]/55 px-6 py-16">
      <div className="max-w-[1600px] mx-auto">
        <h2 className="text-[28px] md:text-4xl font-semibold tracking-[-0.028em] leading-[1.06] max-w-[480px] mb-12">
          One platform, three relationships.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-stretch">
          {CARDS.map((card) => (
            <div key={card.label} className="flex flex-col border border-border bg-white p-7">
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
                className="mt-auto block w-full bg-brand px-4 py-2.5 text-center font-mono text-xs font-semibold text-white transition-colors hover:bg-emerald-50 hover:text-emerald-700"
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
