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
    body: "Profile, CV, studio feed, available works. Free forever.",
    features: [
      "Find grants and residencies",
      "Build a public profile and CV",
      "Post studio updates and works",
      "Get found by curators and collectors",
    ],
    cta: { text: "Create artist account — free", href: "/get-started" },
  },
  {
    label: "Patron",
    headline: "Support the artists you love.",
    body: "Monthly support goes directly to the artist. Follow their practice, access studio updates.",
    features: [
      "Support from $8/month",
      "Studio updates and posts",
      "First access to available works",
      "Listed as patron in catalogues",
    ],
    cta: { text: "Become a patron", href: "/support" },
  },
  {
    label: "Partner / Funder",
    headline: "Reach the right artists.",
    body: "Post grants, residencies, and open calls to 480+ artists. Manage applications in one place.",
    features: [
      "Post opportunities — free",
      "Review applications online",
      "Track outcomes and reporting",
      "Reach NZ & Australian artists",
    ],
    cta: { text: "Post an opportunity", href: "/partners" },
  },
];

export function WhoIsPatronageFor() {
  return (
    <section className="border-t border-border px-6 pt-16 pb-20">
      <div className="max-w-[1600px] mx-auto">
        <div className="text-center space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            Who is Patronage for?
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-stone-900">
            One platform, three relationships.
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
          {CARDS.map((card) => {
            const inverted = card.label === "Artist / Creative";
            return (
              <div
                key={card.label}
                className={`flex flex-col rounded-xl p-8 ${
                  inverted
                    ? "bg-stone-900"
                    : "bg-stone-50 border border-stone-100"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
                  {card.label}
                </p>

                <h3
                  className={`mt-3 text-xl font-bold leading-tight ${
                    inverted ? "text-white" : "text-stone-900"
                  }`}
                >
                  {card.headline}
                </h3>

                <p
                  className={`mt-2 text-sm ${
                    inverted ? "text-stone-300" : "text-stone-500"
                  }`}
                >
                  {card.body}
                </p>

                <ul className="mt-6 space-y-2.5">
                  {card.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex gap-2 text-sm ${
                        inverted ? "text-stone-300" : "text-stone-600"
                      }`}
                    >
                      <span className="text-stone-300 select-none">—</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-8">
                  <Link
                    href={card.cta.href}
                    className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
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
