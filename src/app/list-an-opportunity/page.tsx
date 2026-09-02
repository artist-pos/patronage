import Link from "next/link";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { OpportunityTipForm } from "@/components/opportunities/OpportunityTipForm";

export const metadata: Metadata = {
  title: "List an opportunity | Patronage",
  description:
    "Three ways to get an opportunity in front of artists in Aotearoa and Australia: a free listing, a managed application pipeline, or a tip about a listing you found somewhere else.",
};

const NUM = "font-mono text-[11px] tracking-[0.08em] text-[color:var(--fg-subtle)]";

function Price({ children, free }: { children: React.ReactNode; free?: boolean }) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.08em] ${
        free ? "text-[color:var(--success)]" : "text-[color:var(--fg-muted)]"
      }`}
    >
      {children}
    </span>
  );
}

function Points({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-[7px]">
      {items.map((item) => (
        <p key={item} className="text-[13px] leading-[1.5] text-[color:var(--fg-muted)]">
          <span className="mr-2 text-[color:var(--fg-subtle)]">→</span>
          {item}
        </p>
      ))}
    </div>
  );
}

export default async function ListAnOpportunityPage() {
  const { supabase, user } = await getServerUser();

  // Pricing copy has to match what they will actually be charged: the first
  // pipeline round is free, every round after it is paid.
  let pipelineFirstRoundUsed = false;
  if (user) {
    const { count } = await supabase
      .from("pipeline_entry_payments")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", user.id)
      .eq("status", "paid");
    pipelineFirstRoundUsed = (count ?? 0) > 0;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
      {/* ══ Header ══ */}
      <header className="border-b border-border py-14">
        <div className="max-w-[720px]">
          <p className="t-section-label mb-3">List an opportunity</p>
          <h1 className="t-display mb-4">Three ways in.</h1>
          <p className="t-body text-[color:var(--fg-muted)]">
            Whether you&rsquo;re running the opportunity yourself or you just spotted one
            worth sharing, there&rsquo;s a route below. They all reach the same place: the
            directory, search, and the weekly digest that goes out to artists.
          </p>
        </div>
      </header>

      {/* ══ 01 — Free listing ══ */}
      <section className="grid grid-cols-1 items-start gap-8 border-b border-border py-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <div className="mb-3 flex items-baseline gap-3">
            <span className={NUM}>01</span>
            <Price free>Free</Price>
          </div>
          <h2 className="t-title mb-3">Free listing</h2>
          <p className="t-body-sm mb-5 max-w-[460px]">
            For when the opportunity is yours to list. You&rsquo;re the organiser, the
            funder, or you have the go-ahead to post it. You write the listing, we review
            it, and it goes live in the directory.
          </p>
          <Link href="/partner/list-free" className="btn btn-brand">
            List for free →
          </Link>
          <p className="t-caption mt-3">
            You can fill in the whole form before signing up. We only ask for an account
            when you submit.
          </p>
        </div>
        <div className="bg-feed-bg p-6">
          <p className="t-section-label mb-4">What you get</p>
          <Points
            items={[
              "A page in the directory, in search, and on the discipline hubs",
              "Included in the weekly digest emailed to artists",
              "Artists can save it and track their application",
              "View tracking, so you can see the reach",
              "Reviewed within two business days. No commitment, no card.",
            ]}
          />
          <p className="t-caption mt-5 border-t border-border pt-4">
            Applications reach you however you already handle them. The listing links
            straight out to your own form or email.
          </p>
        </div>
      </section>

      {/* ══ 02 — Pipeline ══ */}
      <section className="grid grid-cols-1 items-start gap-8 border-b border-border py-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <div className="mb-3 flex items-baseline gap-3">
            <span className={NUM}>02</span>
            {pipelineFirstRoundUsed ? (
              <Price>$200 NZD per round</Price>
            ) : (
              <Price free>First round free</Price>
            )}
          </div>
          <h2 className="t-title mb-3">Pipeline</h2>
          <p className="t-body-sm mb-5 max-w-[460px]">
            Everything in a free listing, and artists apply here rather than by email.
            Their portfolio, CV, and practice statement attach themselves, so you review
            complete applications on a board instead of chasing PDFs around an inbox.
          </p>
          <Link
            href={user ? "/partner/opportunities/new?type=pipeline" : "/partner/list-pipeline"}
            className="btn btn-primary"
          >
            {pipelineFirstRoundUsed ? "Set up a pipeline →" : "Start your first round free →"}
          </Link>
          <p className="t-caption mt-3">
            {pipelineFirstRoundUsed
              ? "Charged per round, plus the card processing fee."
              : "After your first round it’s $200 NZD per round."}
          </p>
        </div>
        <div className="bg-feed-bg p-6">
          <p className="t-section-label mb-4">What you get</p>
          <Points
            items={[
              "Application questions you write yourself",
              "A dashboard with kanban, table, and triage views",
              "Committee scoring against a rubric you set",
              "Staged notifications for shortlisting, selecting, and declining",
              "Production asset delivery through signed links",
              "Six and twelve-month impact reporting for your board",
            ]}
          />
          <p className="t-caption mt-5 border-t border-border pt-4">
            Best for open calls, commissions, and residencies where you expect more
            applications than one inbox can hold.
          </p>
        </div>
      </section>

      {/* ══ 03 — Community tip ══ */}
      <section
        id="tip"
        className="grid scroll-mt-16 grid-cols-1 items-start gap-8 border-b border-border py-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16"
      >
        <div>
          <div className="mb-3 flex items-baseline gap-3">
            <span className={NUM}>03</span>
            <Price free>Free</Price>
          </div>
          <h2 className="t-title mb-3">Community tip</h2>
          <p className="t-body-sm mb-5 max-w-[460px]">
            Someone else&rsquo;s opportunity that we&rsquo;ve missed. You don&rsquo;t need an
            account and you don&rsquo;t need to write the listing. Send us the link and
            we&rsquo;ll do the rest, crediting the board we found it on.
          </p>
          <Points
            items={[
              "No account, and nothing to fill in on the organiser's behalf",
              "We check it, write it up, and publish it if it fits",
              "Open to artists in Aotearoa or Australia, which is the only bar",
            ]}
          />
        </div>
        <div className="bg-feed-bg p-6">
          <p className="t-section-label mb-4">Send us the link</p>
          <OpportunityTipForm />
        </div>
      </section>

      {/* ══ Footer note ══ */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-10">
        <p className="t-body-sm max-w-[560px]">
          Commissioning artists for a surface you already own, like hoardings, vehicles,
          packaging, or screens? Or after help shaping a whole programme? That&rsquo;s an
          activation, and it works differently.
        </p>
        <Link href="/partners" className="btn btn-outline shrink-0">
          Partner options →
        </Link>
      </div>
    </div>
  );
}
