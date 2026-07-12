import type { Metadata } from "next";

// Internal design reference. Not linked in nav; excluded from search.
export const metadata: Metadata = {
  title: "Design System v2",
  robots: { index: false, follow: false },
};

/* Small helpers local to this reference page ------------------------------ */

function Section({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-16 mt-16 first:mt-0 first:border-0 first:pt-0">
      <p className="t-section-label mb-3">{label}</p>
      <h2 className="t-title mb-8">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({
  name,
  varName,
  className,
}: {
  name: string;
  varName: string;
  className: string;
}) {
  return (
    <div>
      <div className={`h-16 border border-border ${className}`} />
      <p className="t-mono-sm mt-2">{name}</p>
      <p className="t-mono-sm text-[color:var(--fg-subtle)]">{varName}</p>
    </div>
  );
}

/* Reference sheet --------------------------------------------------------- */

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-[1600px] px-6 py-16">
      <header className="mb-16">
        <p className="t-section-label mb-3">Patronage</p>
        <h1 className="t-display mb-4">Design System v2</h1>
        <p className="t-body max-w-2xl text-[color:var(--fg-muted)]">
          Warm infrastructure for artists. Precise, undecorated, confident. Built
          to recede so the work leads. Containerless — content is the element;
          structure comes from the 1px gap, type hierarchy, and hover
          attribution.
        </p>
      </header>

      {/* ─── Colour ─────────────────────────────────────────────────────── */}
      <Section label="Foundations" title="Colour">
        <p className="t-section-label mb-4">Surfaces &amp; foreground</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 mb-10">
          <Swatch name="Background" varName="--background" className="bg-background" />
          <Swatch name="Surface" varName="--surface" className="bg-card" />
          <Swatch name="Surface muted" varName="--surface-muted" className="bg-muted" />
          <Swatch name="Feed surface" varName="--feed-bg" className="bg-feed-bg" />
          <Swatch name="Foreground" varName="--foreground" className="bg-foreground" />
          <Swatch name="FG muted" varName="--fg-muted" className="bg-[color:var(--fg-muted)]" />
          <Swatch name="FG subtle" varName="--fg-subtle" className="bg-[color:var(--fg-subtle)]" />
        </div>

        <p className="t-section-label mb-4">Brand — civic teal (used sparingly)</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 mb-10">
          <Swatch name="Brand" varName="--brand" className="bg-brand" />
          <Swatch name="Brand sub" varName="--brand-sub" className="bg-brand-sub" />
        </div>

        <p className="t-section-label mb-4">Semantic</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 mb-10">
          <Swatch name="Success" varName="--success" className="bg-success" />
          <Swatch name="Warning" varName="--warning" className="bg-warning" />
          <Swatch name="Urgent" varName="--urgent" className="bg-urgent" />
        </div>

        <p className="t-section-label mb-4">Stone scale</p>
        <div className="grid grid-cols-5 gap-4 sm:grid-cols-9">
          {[
            ["50", "bg-stone-50"], ["100", "bg-stone-100"], ["200", "bg-stone-200"],
            ["300", "bg-stone-300"], ["400", "bg-stone-400"], ["500", "bg-stone-500"],
            ["600", "bg-stone-600"], ["700", "bg-stone-700"], ["800", "bg-stone-800"],
          ].map(([n, c]) => (
            <Swatch key={n} name={`stone-${n}`} varName="" className={c} />
          ))}
        </div>
      </Section>

      {/* ─── Type — two voices ──────────────────────────────────────────── */}
      <Section label="Foundations" title="Two-voice type system">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="t-section-label mb-6">Geist Sans — content</p>
            <div className="space-y-6">
              <div>
                <p className="t-display">Display 48</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-display · 600 · −0.032em</p>
              </div>
              <div>
                <p className="t-title">Title 28</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-title · 600 · −0.025em</p>
              </div>
              <div>
                <p className="t-heading">Heading 20</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-heading · 600 · −0.02em</p>
              </div>
              <div>
                <p className="t-body">Body 16 — default reading text. The quick brown fox jumps over the lazy dog.</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-body · 400 · 1.65 lh</p>
              </div>
              <div>
                <p className="t-body-sm">Body small 14 — card copy, form help text.</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-body-sm</p>
              </div>
              <div>
                <p className="t-caption">Caption 12 — timestamps, metadata.</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-caption</p>
              </div>
            </div>
          </div>

          <div>
            <p className="t-section-label mb-6">Geist Mono — interface / data</p>
            <div className="space-y-6">
              <div>
                <p className="t-mono-amount">$25,000 NZD</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-mono-amount · funding</p>
              </div>
              <div>
                <p className="t-mono">3 days left · @username · 14 Jun 2026</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-mono · countdowns, handles, timestamps</p>
              </div>
              <div>
                <p className="t-mono-sm">open call · NZ · visual art · free</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-mono-sm · dot-separated tags</p>
              </div>
              <div>
                <p className="t-section-label">Selected work</p>
                <p className="t-mono-sm text-[color:var(--fg-subtle)] mt-1">.t-section-label · ALL CAPS · stone-400</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Nav ─────────────────────────────────────────────────────────── */}
      <Section label="Components" title="Navigation">
        <p className="t-section-label mb-4">Mono · lowercase · dot-separated · teal active state</p>
        <nav className="flex items-center gap-6 border-b border-border pb-3">
          {[
            ["explore", false], ["opportunities", true], ["artists", false],
            ["for you", false], ["feed", false],
          ].map(([label, active]) => (
            <a
              key={label as string}
              href="#"
              className={`font-mono text-[13px] lowercase pb-3 -mb-3 transition-colors ${
                active
                  ? "text-brand border-b-2 border-brand"
                  : "text-[color:var(--fg-muted)] hover:text-foreground"
              }`}
            >
              {label}
            </a>
          ))}
        </nav>
      </Section>

      {/* ─── Buttons ─────────────────────────────────────────────────────── */}
      <Section label="Components" title="Buttons">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-brand">Brand CTA</button>
          <button className="btn btn-outline">Outline</button>
          <button className="btn btn-ghost">Ghost</button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary btn-sm">Primary sm</button>
          <button className="btn btn-outline btn-sm">Outline sm</button>
          <button className="btn btn-ghost btn-sm">Ghost sm</button>
        </div>
      </Section>

      {/* ─── Pills / tags ────────────────────────────────────────────────── */}
      <Section label="Components" title="Pills, tags &amp; match scores">
        <p className="t-section-label mb-4">Tags — square bordered mono chips, dot-free</p>
        <div className="flex flex-wrap items-center gap-1.5 mb-10">
          <span className="tag">NZ</span>
          <span className="tag">visual art</span>
          <span className="tag">free</span>
          <span className="tag pill-subdued">subdued</span>
          <span className="pill-dark px-2 py-1">AVAILABLE · 1 OF 3</span>
        </div>

        <p className="t-section-label mb-4">Match scores (For You)</p>
        <div className="flex flex-wrap items-center gap-3 mb-10">
          <span className="pill pill-match-strong">73% match</span>
          <span className="pill pill-match-partial">54% match</span>
          <span className="pill pill-match-weak">31% match</span>
        </div>

        <p className="t-section-label mb-4">Status indicators</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="status-open">Open</span>
          <span className="status-open status-warning">Closes in 9 days</span>
          <span className="status-open status-urgent">Closes tomorrow</span>
        </div>
      </Section>

      {/* ─── Badges ─────────────────────────────────────────────────────── */}
      <Section label="Components" title="Badges — artist achievements">
        <div className="flex flex-wrap items-center gap-3">
          <span className="badge badge-verified">Verified</span>
          <span className="badge badge-exhibited">Exhibited</span>
          <span className="badge badge-grant">Grant recipient</span>
        </div>
      </Section>

      {/* ─── Pins ────────────────────────────────────────────────────────── */}
      <Section label="Feed" title="Pin vocabulary — containerless">
        <p className="t-body-sm mb-8 max-w-2xl">
          Figure-ground separation: the feed surface is #EFEEEC, non-image pins
          sit white on it, image pins run edge-to-edge. The 8px gap shows the
          feed surface — no borders needed. Hover an image pin: it dims to 0.85
          and a crisp black attribution bar reveals. No scale, no lift, no glass.
          Opportunity pins carry one mark — a 3px teal left border.
        </p>
        <div className="grid gap-2 bg-feed-bg p-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Image pin — edge-to-edge, no container */}
          <div className="pin relative">
            <div
              data-pin-img
              className="aspect-[4/5] bg-gradient-to-br from-stone-300 to-stone-500"
            />
            <div data-pin-overlay>
              <p className="text-white text-[13px] font-medium">Composition in Ochre</p>
              <p className="font-mono text-[10px] text-white/50 mt-0.5">Anahera Reweti · 2024</p>
            </div>
          </div>

          {/* Work for sale */}
          <div className="pin relative">
            <div
              data-pin-img
              className="aspect-[4/5] bg-gradient-to-br from-stone-400 to-stone-600"
            />
            <span className="pill-dark absolute top-3 left-3">AVAILABLE · 1 OF 3</span>
            <div data-pin-overlay>
              <p className="text-white text-[13px] font-medium">Untitled (Series III)</p>
              <p className="font-mono text-[13px] font-semibold text-white mt-0.5">$1,200 NZD</p>
              <p className="font-mono text-[10px] text-white/50 mt-0.5">Blake Aitken</p>
            </div>
          </div>

          {/* Opportunity pin — white, 3px teal left border, teal tint on hover */}
          <div className="pin-opportunity cursor-pointer">
            <p className="t-kicker mb-3">Grant</p>
            <p className="text-[17px] font-semibold leading-snug tracking-[-0.02em] mb-2">
              Te Tuhi Emerging Artist Commission
            </p>
            <p className="font-mono text-[12px] text-[color:var(--fg-muted)] mb-3.5">Te Tuhi</p>
            <div className="border-t border-border pt-3 mb-3 flex items-baseline justify-between">
              <span className="font-mono text-[22px] font-semibold">
                $8,000 <span className="text-[11px] font-normal text-[color:var(--fg-muted)]">NZD</span>
              </span>
              <span className="font-mono text-[11px] font-medium text-[color:var(--urgent)]">5 days left</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="tag">NZ</span>
              <span className="tag">visual art</span>
              <span className="tag">free</span>
            </div>
          </div>

          {/* Text pin — white on feed surface */}
          <div className="pin-text p-5 cursor-pointer">
            <p className="t-kicker mb-3.5">Studio update</p>
            <p className="text-[17px] leading-[1.62] tracking-[-0.01em] mb-4">
              Spent the week priming panels for the Dunedin show. Six down, four to
              go before the varnish stage.
            </p>
            <div className="border-t border-border pt-3">
              <span className="text-[13px] font-medium">Anahera Reweti</span>
              <span className="font-mono text-[10px] text-[color:var(--fg-subtle)] ml-2">2 days ago</span>
            </div>
          </div>

          {/* Audio pin */}
          <div className="pin-audio p-5 cursor-pointer">
            <p className="t-kicker mb-3">Audio</p>
            <p className="text-[15px] font-medium mb-0.5">Field recording — Otira</p>
            <p className="font-mono text-[11px] text-[color:var(--fg-muted)] mb-4">Aroha Ngata</p>
            <div className="flex items-center gap-2.5">
              <button className="h-[30px] w-[30px] shrink-0 bg-foreground flex items-center justify-center">
                <svg className="w-[11px] h-[11px] ml-0.5" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
              <div className="relative h-px flex-1 bg-border">
                <div className="h-full w-[38%] bg-foreground" />
              </div>
              <span className="font-mono text-[11px] text-[color:var(--fg-muted)]">3:42</span>
            </div>
          </div>

          {/* Article pin */}
          <div className="pin bg-card">
            <div className="overflow-hidden">
              <div data-pin-img className="aspect-[16/9] bg-gradient-to-br from-stone-200 to-stone-400" />
            </div>
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="tag">essay</span>
                <span className="font-mono text-[11px] text-[color:var(--fg-subtle)]">6 min read</span>
              </div>
              <p className="text-[17px] font-semibold leading-snug tracking-[-0.022em] mb-2">
                On the economics of the residency
              </p>
              <p className="t-body-sm line-clamp-2 mb-3.5">
                What does it actually cost to say yes to three months away — and who
                can afford to?
              </p>
              <div className="border-t border-border pt-3">
                <span className="text-[13px] font-medium">Patronage</span>
                <span className="font-mono text-[10px] text-[color:var(--fg-subtle)] ml-2">26 Jun 2026</span>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
