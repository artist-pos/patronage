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
    label: "Artist / Creative",
    headline: "One URL for your whole practice.",
    body: "Profile, CV, studio feed, available works — free to join.",
    features: [
      "Find grants and residencies",
      "Build a public profile and CV",
      "Share studio updates and works",
      "Be discovered by patrons and partners",
    ],
    cta: { text: "Create artist account — free", href: "/get-started" },
  },
  {
    label: "Patron",
    headline: "Support the artists you love.",
    body: "Back an artist monthly or one-off — support goes directly to them.",
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
    body: "Post opportunities and run applications through a built-in pipeline — no more Google Forms.",
    features: [
      "Post opportunities — free",
      "Replace Google Forms with Patronage Pipeline",
      "Review and shortlist applications online",
      "Reach NZ & Australian artists",
    ],
    cta: { text: "Post an opportunity", href: "/partners" },
  },
];

export function WhoIsPatronageFor() {
  return (
    <section className="border-t border-border px-6 pt-20 pb-24">
      <div className="max-w-[1600px] mx-auto">
        <div className="text-center space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Who is Patronage for?
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-stone-900">
            One platform, three relationships.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch max-w-5xl mx-auto">
          {CARDS.map((card) => {
            const inverted = card.label === "Artist / Creative";
            return (
              <div
                key={card.label}
                className={`flex flex-col rounded-xl p-6 ${
                  inverted
                    ? "bg-stone-900"
                    : "bg-stone-50 border border-stone-100"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                  {card.label}
                </p>

                <h3
                  className={`mt-3 text-base font-semibold leading-snug ${
                    inverted ? "text-white" : "text-stone-900"
                  }`}
                >
                  {card.headline}
                </h3>

                <p
                  className={`mt-1.5 text-[13px] leading-relaxed ${
                    inverted ? "text-stone-300" : "text-stone-500"
                  }`}
                >
                  {card.body}
                </p>

                <ul className="mt-5 space-y-2">
                  {card.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex gap-2 text-[13px] leading-relaxed ${
                        inverted ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      <span className="text-stone-300 select-none">—</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6">
                  <Link
                    href={card.cta.href}
                    className={`block w-full rounded-lg px-4 py-2 text-center text-[13px] font-medium transition-colors ${
                      inverted
                        ? "bg-white text-stone-900 hover:bg-stone-100"
                        : card.label === "Patron"
                          ? "bg-stone-900 text-white hover:bg-stone-800"
                          : "border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white"
                    }`}
                  >
                    {card.cta.text}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
