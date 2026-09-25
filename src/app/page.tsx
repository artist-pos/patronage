import Link from "next/link";
import type { Metadata } from "next";
import { FeedCard } from "@/components/feed/FeedCard";
import { getCachedHomeData, getCachedVerifiedHandles } from "@/lib/home-data";
import { RotatingHandle } from "@/components/home/RotatingHandle";
import { RollingHeadline } from "@/components/home/RollingHeadline";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { OppRow, ArtistFeature, ArtistCompact, DISCIPLINES } from "@/components/home/HomeParts";
import type { ProjectUpdateWithArtist } from "@/types/database";

export const metadata: Metadata = {
  // Absolute: the brand already leads, so the layout template must not add it again.
  title: { absolute: "Patronage | Art Grants & Opportunities for NZ & Australian Artists" },
  description:
    "Patronage connects New Zealand and Australian artists with grants, residencies, commissions, and open calls. Live opportunities updated weekly.",
  alternates: { canonical: "https://patronage.nz" },
  openGraph: {
    title: "Patronage | Art Grants & Opportunities for NZ & Australian Artists",
    description:
      "Patronage connects New Zealand and Australian artists with grants, residencies, commissions, and open calls. Live opportunities updated weekly.",
    url: "https://patronage.nz",
    type: "website",
  },
};

// Buttons on this page all speak in the sans voice, one height, so rows line
// up. (.btn-outline / .btn-ghost in globals are the mono "interface" voice.)
const BTN =
  "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg px-5 text-[14px] font-medium tracking-[-0.01em] transition-colors";
const BTN_PRIMARY = `${BTN} bg-brand text-white hover:opacity-90`;
const BTN_OUTLINE = `${BTN} border border-foreground text-foreground hover:bg-foreground/5`;
// Hero: the primary button sits at its natural width beside quiet text links.
const BTN_PRIMARY_AUTO = BTN_PRIMARY.replace("w-full", "w-auto");
const TEXT_LINK =
  "inline-flex h-11 items-center gap-1.5 text-[14px] font-medium text-foreground underline decoration-[color:var(--fg-subtle)] underline-offset-4 transition-colors hover:decoration-foreground";

// Hero photo and the theme tuned to it: a light, soft macro, so the frosted
// panels read as paler glass edged by a soft shadow.
const PHOTO = {
  src: "/images/hero-blur.webp",
  width: 1600,
  height: 1600,
  base: "bg-[#E9E6DF]",
  glass:
    "border border-white/60 bg-white/55 shadow-[0_8px_40px_rgba(0,0,0,0.14)] backdrop-blur-2xl backdrop-saturate-150",
  muted: "text-[color:var(--fg-muted)]",
  statN: "text-foreground",
  statL: "text-[color:var(--fg-muted)]",
  credit: "text-white/85 hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]",
  label: "text-[#B23A2E]",
} as const;

// The headline rolls through what each audience comes here to find; the body
// splits into the offer line and the profile-link caption around {url}.
const HERO = {
  prefix: "Find",
  rotate: ["an opportunity.", "an artist.", "your audience."],
  body: "Grants, residencies, commissions and open calls for artists in Aotearoa and beyond. Your profile holds your bio, CV and work, ready to send with any application. {url}",
  profileLead: "Build your profile once. Use it across applications.",
} as const;

const STEPS = [
  {
    title: "Build your profile",
    body: "Add your bio, CV and three works. It lives at patronage.nz/yourname.",
  },
  {
    title: "Find an opportunity",
    body: "Grants, residencies, commissions and open calls, matched to your discipline and emailed to you weekly.",
  },
  {
    title: "Apply",
    body: "Send your profile with an application, or apply directly through Patronage when an organisation runs its opportunity here.",
  },
  {
    title: "Keep building",
    body: "Add new work, exhibitions and awards as your career moves.",
  },
];

const AUDIENCES = [
  {
    label: "For artists",
    title: "Build your profile once.",
    body: "Find opportunities, apply with the work that fits, and be found by organisations and supporters.",
    cta: { text: "Build your profile", href: "/auth/signup?role=artist", primary: true },
  },
  {
    label: "For organisations",
    title: "Find artists. Run the opportunity.",
    body: "Publish an opportunity, receive applications and manage selection in one place.",
    cta: { text: "For organisations", href: "/partners", primary: false },
  },
  {
    label: "For supporters",
    title: "Follow the work. Back the artist.",
    body: "Follow artists, discover new work, and support what they make.",
    cta: { text: "Support an artist", href: "/patrons", primary: false },
  },
];

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden className="shrink-0 text-foreground">
      <path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Row({ children, done = true }: { children: React.ReactNode; done?: boolean }) {
  return (
    <li className="flex items-center gap-3 py-2 text-[15px]">
      {done ? <Tick /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-[color:var(--fg-subtle)]" />}
      <span className={done ? "" : "text-[color:var(--fg-muted)]"}>{children}</span>
    </li>
  );
}

// What a Patronage application looks like — the profile fills it, the artist
// only writes the project-specific answers. Two white tiles on the feed
// surface (design system: figure-ground, no borders).
function ProfileToApplication() {
  return (
    <div aria-label="How a profile fills an application" className="flex h-full flex-col gap-2">
      <div className="flex-1 bg-white p-6">
        <p className="t-kicker mb-1">Your profile</p>
        <p className="mb-3 font-mono text-[13px] text-foreground">patronage.nz/yourname</p>
        <ul>
          <Row>Bio and artist statement</Row>
          <Row>CV, exhibitions and press</Row>
          <Row>Portfolio: three works</Row>
        </ul>
      </div>

      <div className="flex items-center gap-2.5 px-1 py-1 text-[13px] text-[color:var(--fg-muted)]">
        <svg viewBox="0 0 16 24" width="12" height="18" fill="none" aria-hidden>
          <path d="M8 2v18M2 14l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Send the link with any application
      </div>

      <div className="flex-1 bg-white p-6">
        <p className="t-kicker mb-4">Any application</p>
        <ul>
          <Row>Your portfolio link, pasted in</Row>
          <Row>Your CV and work, one click away</Row>
          <Row done={false}>Answers to the project questions</Row>
        </ul>
      </div>
    </div>
  );
}

export default async function Home() {
  const photo = PHOTO;
  const hero = HERO;

  const today = new Date().toISOString().split("T")[0];
  const [{ user }, data, verifiedHandles] = await Promise.all([
    getServerUser(),
    getCachedHomeData(today),
    getCachedVerifiedHandles(),
  ]);
  // Copy before the {url} token is split into sentences, each on its own line;
  // the token becomes the profile URL, always the last line.
  const bodyParts = hero.body.split("{url}");
  const sentences = bodyParts[0].trim().split(/(?<=\.)\s+/);
  const { opportunities, oppCount, artistCount, partnerCount, recentArtists, artists, spotlightArtist, updates } = data;

  // Real names only — bare handles read as bot signups to a first-time visitor.
  // The admin-set spotlight artist fronts the section, as on the live homepage.
  const named = [...artists, ...recentArtists].filter(
    (a, i, all) => a.full_name?.trim() && all.findIndex((b) => b.id === a.id) === i
  );
  const featureArtist = spotlightArtist ?? named[0] ?? null;
  const compactArtists = named.filter((a) => a.id !== featureArtist?.id).slice(0, 3);

  const visibleUpdates = (user ? updates : updates.filter((u) => !u.admin_hidden)).slice(0, 10);
  const cols: ProjectUpdateWithArtist[][] = [[], [], [], [], []];
  visibleUpdates.forEach((u, i) => cols[i % 5].push(u));
  const colCls = [
    "flex min-w-0 flex-1 flex-col gap-2",
    "flex min-w-0 flex-1 flex-col gap-2",
    "hidden min-w-0 flex-1 flex-col gap-2 sm:flex",
    "hidden min-w-0 flex-1 flex-col gap-2 lg:flex",
    "hidden min-w-0 flex-1 flex-col gap-2 xl:flex",
  ];

  const stats: [string, string][] = [
    [`${oppCount}+`, "opportunities"],
    [`${artistCount}`, "artists"],
    ...(partnerCount > 0 ? ([[`${partnerCount}`, "organisations"]] as [string, string][]) : []),
    ["Free", "to join"],
  ];

  return (
    <div>
      {/* Smooth in-page scrolling for "Find out more", and a lighter (75%) frosted
          header so the hero photo reads through it. Scoped to this page: the
          style unmounts when you navigate away. */}
      <style>{`html{scroll-behavior:smooth}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}body>header,header.sticky{background-color:rgb(250 250 249 / 0.75)!important;border-bottom-color:rgb(255 255 255 / 0.35)!important}`}</style>
      {/* ══ HERO — the idea left, the proof right ══ */}
      <section className={`relative isolate -mt-[53px] overflow-hidden lg:flex lg:min-h-[100svh] lg:flex-col lg:justify-center ${photo.base}`}>
        {/* Decorative photo; the frosted panels sit over it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt=""
          aria-hidden="true"
          width={photo.width}
          height={photo.height}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
        />
        {/* Photo credit, bottom-right on the photo. */}
        <Link
          href="/ceciliazhang0329"
          title="Background photo by 心怡 / Xinyi Zhang"
          className={`absolute bottom-[70px] right-6 z-10 text-[11px] underline-offset-4 transition-colors hover:underline sm:right-12 ${photo.credit}`}
        >
          <span className="sr-only">Background photo by </span>
          心怡 / Xinyi Zhang
        </Link>
        <div className="relative mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-12 px-6 pb-[110px] pt-[101px] sm:px-12 lg:grid-cols-[5fr_4fr] lg:gap-20 lg:pb-[86px] lg:pt-[85px]">
        <div className="flex flex-col justify-between">
          {/* The hero's frame, now frosted glass. Stats sit outside it, on the photo. */}
          <div className={`max-w-[580px] p-6 sm:p-9 ${photo.glass}`}>
            <div className="mb-6 flex h-6 items-center">
              <p className="t-section-label">A more connected arts ecosystem</p>
            </div>
            <h1 className="t-display max-w-[640px] text-[40px] sm:text-[52px]">
              <RollingHeadline prefix={hero.prefix} phrases={[...hero.rotate]} />
            </h1>
            {/* What's on offer, then the link itself shown as an object: a
                field holding the URL, with the profile sentence as its caption.
                The URL is one truncated line, so any handle length is stable. */}
              <div className="mt-6 max-w-[520px]">
                <p className="t-body text-[color:var(--fg-muted)]">{sentences[0]}</p>
                {hero.profileLead && (
                  <p className="mt-5 text-[15px] font-medium tracking-[-0.01em] text-foreground">{hero.profileLead}</p>
                )}
                <div className={`${hero.profileLead ? "mt-2.5" : "mt-5"} border border-foreground/10 bg-white/70 px-4 py-3`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden className="shrink-0 text-[color:var(--fg-muted)]">
                      <path
                        d="M6.5 9.5a3 3 0 0 0 4.24 0l2.12-2.12a3 3 0 0 0-4.24-4.24l-.7.7M9.5 6.5a3 3 0 0 0-4.24 0L3.14 8.62a3 3 0 0 0 4.24 4.24l.7-.7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                    <p className="min-w-0 truncate font-mono text-[12.5px] text-foreground sm:text-[14px]">
                      patronage.nz/
                      <RotatingHandle handles={verifiedHandles} />
                    </p>
                  </div>
                  {sentences[1] && (
                    <p className="mt-1.5 text-[13px] leading-snug text-[color:var(--fg-muted)]">{sentences.slice(1).join(" ")}</p>
                  )}
                </div>
              </div>

            {/* One button, two quiet links. "Find out more" scrolls to How it
                works in place. */}
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/opportunities" className={BTN_PRIMARY_AUTO}>
                Browse opportunities <span aria-hidden>→</span>
              </Link>
              {/* Signed-in visitors already have an account and skip the
                  explainer sections, so neither link applies to them. */}
              {!user && (
                <>
                  <Link href="/auth/signup?role=artist" className={TEXT_LINK}>
                    Build your profile
                  </Link>
                  <a
                    href="#how-it-works"
                    className={`${TEXT_LINK} !font-normal !text-[color:var(--fg-muted)] hover:!text-foreground`}
                  >
                    Find out more <span aria-hidden>↓</span>
                  </a>
                </>
              )}
            </div>

            {/* Other audiences, straight to signup. The question sits on its own
                line so the two links read as separate choices, not a sentence. */}
            {!user && (
            <div className="mt-7">
              <p className="text-[13px] text-[color:var(--fg-muted)]">Not an artist?</p>
              <div className="mt-1.5 flex flex-wrap gap-x-7 gap-y-1 text-[14px] font-medium">
                <Link
                  href="/partners"
                  className="underline decoration-[color:var(--fg-subtle)] underline-offset-4 transition-colors hover:decoration-foreground"
                >
                  I’m a partner organisation
                </Link>
                <Link
                  href="/patrons"
                  className="underline decoration-[color:var(--fg-subtle)] underline-offset-4 transition-colors hover:decoration-foreground"
                >
                  I support artists
                </Link>
              </div>
            </div>
            )}
          </div>

          <dl className="mt-16 grid lg:mt-10 grid-cols-2 gap-x-6 gap-y-6 sm:flex sm:gap-x-12">
            {stats.map(([n, label]) => (
              <div key={label}>
                <dt className={`font-mono text-[28px] font-semibold leading-none tracking-[-0.02em] ${photo.statN}`}>{n}</dt>
                <dd className={`mt-2 text-[13px] ${photo.statL}`}>{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={`self-start p-5 sm:p-6 ${photo.glass}`}>
          {/* Same urgency cues as the live homepage: red marker, red label,
              red countdowns on every row, and the green "browse all" bar. */}
          <div className="mb-6 flex h-6 items-center justify-between">
            <span className={`flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.05em] ${photo.label}`}>
              <span className="h-[7px] w-[7px] shrink-0 bg-[#B23A2E]" />
              Closing soon
            </span>
            <Link
              href="/opportunities"
              className="text-[13px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
            >
              All {oppCount}+ →
            </Link>
          </div>
          <div className="border-t-2 border-[#B23A2E]">
            <div className="flex flex-col pt-2">
              {opportunities.slice(0, 6).map((opp) => (
                <OppRow key={opp.id} opp={opp} variant="glass" />
              ))}
            </div>
            <Link
              href="/opportunities"
              className="mt-3 flex items-center justify-between rounded-lg bg-brand px-5 py-3.5 text-white transition-opacity hover:opacity-90"
            >
              <span>
                <span className="block text-[14px] font-medium">Browse all opportunities</span>
                <span className="block text-[12px] text-white/70">{oppCount}+ active · updated weekly</span>
              </span>
              <span aria-hidden className="text-lg">→</span>
            </Link>
          </div>
        </div>
        </div>
      </section>

      {/* ══ DISCIPLINES — marquee. A feed-surface strip between the page tone and the white artists section: the tone change is the separator. ══ */}
      <div className="relative z-10 -mt-[54px] flex h-[54px] items-center overflow-hidden border-t border-white/35 bg-[rgb(250_250_249/0.75)] backdrop-blur-lg">
        <div className="flex w-max animate-[scroll-left_55s_linear_infinite] items-center motion-reduce:animate-none">
          {[0, 1].map((dup) => (
            <span key={dup} className="flex items-center" aria-hidden={dup === 1}>
              {DISCIPLINES.map((d) => (
                <span key={`${dup}-${d}`} className="flex items-center">
                  <span className="whitespace-nowrap px-4 font-mono text-[11px] text-[color:var(--fg-muted)]">{d}</span>
                  <span className="px-1 text-border">·</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ══ ARTISTS — featured artist left, three more right, as tinted tiles on white ══ */}
      {featureArtist && (
        <section className="bg-white">
          <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <p className="t-section-label mb-3">Artists on Patronage</p>
                <h2 className="t-display text-[36px] sm:text-[44px]">{artistCount} artists and counting.</h2>
              </div>
              <Link
                href="/artists"
                className="shrink-0 text-[13px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
              >
                All artists →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-x-20 gap-y-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:items-stretch">
              <div className="relative min-h-[420px] min-w-0">
                <ArtistFeature a={featureArtist} spotlit={!!spotlightArtist} bare />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                {compactArtists.map((a) => (
                  <div key={a.id} className="flex min-w-0 flex-1 bg-feed-bg">
                    <ArtistCompact a={a} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Explainers are for newcomers; signed-in visitors go straight from
          the live opportunities and artists to the studio feed. */}
      {!user && (
        <>
      {/* ══ HOW IT WORKS — white tiles on the feed surface, 8px apart ══ */}
      <section id="how-it-works" className="scroll-mt-16 bg-feed-bg">
        <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
          <p className="t-section-label mb-3">How it works</p>
          <h2 className="t-display max-w-[640px] text-[36px] sm:text-[44px]">One profile. Many opportunities.</h2>
          <p className="t-body mt-4 max-w-[540px] text-[color:var(--fg-muted)]">
            Your profile holds the material you repeatedly need, so each application starts from
            what you&rsquo;ve already built.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-x-20 gap-y-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:items-stretch">
            <ol className="flex flex-col gap-2">
              {STEPS.map((step, i) => (
                <li key={step.title} className="grid flex-1 grid-cols-[40px_1fr] items-start bg-white p-6">
                  <span className="pt-1 font-mono text-[11px] text-[color:var(--fg-subtle)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="t-heading">{step.title}</h3>
                    <p className="t-body-sm mt-1.5 max-w-[480px]">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ProfileToApplication />
          </div>
        </div>
      </section>

      {/* ══ WHO IT'S FOR — type and space only ══ */}
      <section>
        <div className="mx-auto max-w-[1600px] px-6 py-20 sm:px-12 lg:py-28">
          <p className="t-section-label mb-3">Who it&rsquo;s for</p>
          <h2 className="t-display max-w-[640px] text-[36px] sm:text-[44px]">What changes for you.</h2>

          <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-14 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.label} className="flex flex-col">
                <p className="text-[13px] font-medium text-[color:var(--fg-muted)]">{a.label}</p>
                <h3 className="t-heading mt-3">{a.title}</h3>
                <p className="t-body-sm mt-2 flex-1">{a.body}</p>
                <div className="mt-8">
                  <Link href={a.cta.href} className={a.cta.primary ? BTN_PRIMARY : BTN_OUTLINE}>
                    {a.cta.text} <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

        </>
      )}

      {/* ══ STUDIO FEED — the feed surface itself ══ */}
      {visibleUpdates.length > 0 && (
        <section className="bg-feed-bg">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex items-end justify-between gap-6 px-6 pb-8 pt-20 sm:px-12 lg:pt-28">
              <div>
                <p className="t-section-label mb-3">Studio feed</p>
                <h2 className="t-display text-[36px] sm:text-[44px]">From the studio.</h2>
              </div>
              <Link
                href="/feed"
                className="shrink-0 text-[13px] text-[color:var(--fg-muted)] transition-colors hover:text-foreground"
              >
                Explore the feed →
              </Link>
            </div>
            <div className="relative max-h-[460px] overflow-hidden px-6 sm:px-12">
              <div className="flex items-start gap-2">
                {cols.map((col, i) => (
                  <div key={i} className={colCls[i]}>
                    {col.map((u) => (
                      <FeedCard key={u.id} u={u} />
                    ))}
                  </div>
                ))}
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
                style={{ background: "linear-gradient(to bottom, rgba(239,238,236,0), var(--feed-bg))" }}
              />
            </div>
            <div className="h-16" />
          </div>
        </section>
      )}

      {!user && (
        <>
      {/* ══ CLOSE ══ */}
      <section>
        <div className="mx-auto flex max-w-[1600px] flex-col items-start gap-8 px-6 py-20 sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:py-28">
          <h2 className="t-display max-w-[560px] text-[36px] sm:text-[48px]">Start with one opportunity.</h2>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[460px]">
            <Link href="/opportunities" className={BTN_PRIMARY}>
              Browse opportunities <span aria-hidden>→</span>
            </Link>
            <Link href="/auth/signup?role=artist" className={BTN_OUTLINE}>
              Build your profile
            </Link>
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}
