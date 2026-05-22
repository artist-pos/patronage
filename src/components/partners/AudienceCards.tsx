const AUDIENCE = [
  {
    type: "Foundations",
    headline: "Distribute grants and commissions",
    body: "Create a managed application pipeline. Artists apply with their Patronage profile — portfolio, CV, and practice statement in one place. No emailed PDFs.",
    cta: "Set up a pipeline →",
    href: "/partner/opportunities/new?type=pipeline",
  },
  {
    type: "Galleries & Museums",
    headline: "Open calls and residencies",
    body: "Run open calls, artist residencies, and exhibition opportunities with a structured application process. Shortlist, score, and notify from one dashboard.",
    cta: "Set up a pipeline →",
    href: "/partner/opportunities/new?type=pipeline",
  },
  {
    type: "Councils",
    headline: "Public art commissions",
    body: "Replace your Google Forms process with a professional pipeline. Committee scoring, staged notifications, and impact reporting are built in.",
    cta: "Set up a pipeline →",
    href: "/partner/opportunities/new?type=pipeline",
  },
  {
    type: "Brands",
    headline: "Activations and commissions",
    body: "Turn existing budgets — hoardings, vehicles, packaging, screens — into commissioned public art with full impact reporting for your organisation.",
    cta: "Talk to activations →",
    href: "#activations",
  },
] as const;

export function AudienceCards() {
  return (
    <div className="border-b border-black">
      <div className="max-w-[1280px] mx-auto px-6 py-16 space-y-10">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Who we work with</p>
          <h2 className="text-2xl font-semibold tracking-tight">Built for arts organisations of every kind.</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-black">
          {AUDIENCE.map((card) => (
            <div key={card.type} className="bg-background p-6 space-y-4 flex flex-col">
              <div className="space-y-2 flex-1">
                <p className="text-xs font-medium uppercase tracking-widest text-stone-400">{card.type}</p>
                <p className="text-base font-semibold leading-snug">{card.headline}</p>
                <p className="text-sm text-stone-500 leading-relaxed">{card.body}</p>
              </div>
              <a
                href={card.href}
                className="text-sm font-medium underline underline-offset-2 hover:text-stone-500 transition-colors"
              >
                {card.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
