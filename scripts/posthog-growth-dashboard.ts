/**
 * Creates the PostHog dashboards:
 *
 *   "Growth Loops"                       — shares, referrals, regional pages, digest
 *   "Signup, prompts & bot protection"   — the signup funnel, the two signup
 *                                          prompts (opportunities grid + "before
 *                                          you go") and what the bot guards block
 *
 * Run once, after the events have started arriving:
 *
 *   POSTHOG_PERSONAL_API_KEY=phx_... POSTHOG_PROJECT_ID=12345 \
 *     npm run posthog:dashboard
 *
 * The personal API key is NOT the NEXT_PUBLIC_POSTHOG_KEY the app ships with —
 * that one can only write events. Make a personal key under
 * Settings → Personal API keys with "Dashboard: write" and "Insight: write"
 * scopes. The project id is the number in your PostHog project URL.
 *
 * Re-running is safe: a dashboard of the same name is reused rather than
 * duplicated, and insights are matched on name.
 */

const HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

// Logged-in routes were not captured before this date, so earlier funnel and
// retention numbers are artefacts rather than a baseline.
const BASELINE = "2026-09-10";

interface InsightSpec {
  name: string;
  description: string;
  query: Record<string, unknown>;
}

interface DashboardSpec {
  name: string;
  description: string;
  insights: InsightSpec[];
}

interface EventSeries {
  id: string;
  name?: string;
  /** Event-property equality filters, e.g. { source: "opportunities_grid_modal" }. */
  where?: Record<string, string>;
}

function eventNode(e: EventSeries, withMath: boolean): Record<string, unknown> {
  return {
    kind: "EventsNode",
    event: e.id,
    name: e.name ?? e.id,
    ...(withMath && { math: "total" }),
    ...(e.where && {
      properties: Object.entries(e.where).map(([key, value]) => ({
        key,
        value,
        operator: "exact",
        type: "event",
      })),
    }),
  };
}

/** A trend of one or more events, optionally broken down by a property. */
function trend(
  events: EventSeries[],
  opts: { breakdown?: string; interval?: "day" | "week"; dateFrom?: string } = {}
): Record<string, unknown> {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      dateRange: { date_from: opts.dateFrom ?? "-90d" },
      interval: opts.interval ?? "week",
      series: events.map((e) => eventNode(e, true)),
      trendsFilter: { display: "ActionsLineGraph" },
      ...(opts.breakdown && {
        breakdownFilter: { breakdown_type: "event", breakdown: opts.breakdown },
      }),
    },
  };
}

function weeklyTrend(events: EventSeries[], breakdown?: string): Record<string, unknown> {
  return trend(events, { breakdown, interval: "week" });
}

/** An ordered funnel: each step must follow the previous within a day. */
function funnel(steps: EventSeries[]): Record<string, unknown> {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "FunnelsQuery",
      dateRange: { date_from: BASELINE },
      series: steps.map((s) => eventNode(s, false)),
      funnelsFilter: {
        funnelVizType: "steps",
        funnelOrderType: "ordered",
        funnelWindowInterval: 1,
        funnelWindowIntervalUnit: "day",
      },
    },
  };
}

const GROWTH_INSIGHTS: InsightSpec[] = [
  {
    name: "Opportunity shares per week — email vs copy link",
    description:
      "How people pass a listing on. Email means they had someone specific in mind.",
    query: weeklyTrend([
      { id: "opportunity_send_to_friend_email", name: "Email" },
      { id: "opportunity_send_to_friend_copy_link", name: "Copy link" },
    ]),
  },
  {
    name: "Referral visits per week by source",
    description: "Arrivals carrying a ?ref= param, split by where the link came from.",
    query: weeklyTrend([{ id: "referral_visit" }], "ref_source"),
  },
  {
    name: "Referral signups per week by source",
    description:
      "Accounts created in a session that began with a referral link. The bottom of the sharing loop.",
    query: weeklyTrend([{ id: "referral_signup" }], "ref_source"),
  },
  {
    name: "Opportunity signup banner — views vs clicks",
    description:
      "Conversion of the notification prompt on opportunity pages. Views fire when the banner is actually scrolled into sight.",
    query: weeklyTrend([
      { id: "opportunity_page_signup_banner_view", name: "Banner seen" },
      { id: "opportunity_page_signup_banner_click", name: "Banner clicked" },
    ]),
  },
  {
    name: "Regional page views by region",
    description: "Which regional pages are earning their keep.",
    query: weeklyTrend([{ id: "regional_page_view" }], "region"),
  },
  {
    name: "Studio update shares by type",
    description: "Instagram Stories, Threads, copy link, and download.",
    query: weeklyTrend([
      { id: "studio_update_share_instagram", name: "Instagram Stories" },
      { id: "studio_update_share_threads", name: "Threads" },
      { id: "studio_update_share_copy_link", name: "Copy link" },
      { id: "studio_update_share_download", name: "Download" },
    ]),
  },
  {
    name: "Closed opportunity recovery clicks",
    description:
      "People who landed on a dead listing and carried on to a live one instead of leaving.",
    query: weeklyTrend([
      { id: "closed_opportunity_recovery_view", name: "Recovery shown" },
      { id: "closed_opportunity_recovery_click", name: "Suggestion clicked" },
    ]),
  },
  {
    name: "Digest engagement",
    description:
      "Opens and clicks from Patronage Weekly. Needs open and click tracking enabled on the sending domain in Resend, plus the /api/webhooks/resend endpoint configured.",
    query: weeklyTrend([
      { id: "digest_email_open", name: "Opened" },
      { id: "digest_email_click", name: "Clicked" },
    ]),
  },
];

const GRID_MODAL = "opportunities_grid_modal";
const BEFORE_YOU_GO = "before_you_go_external_apply";

// signup_account_created and signup_onboarding_completed are written to
// Supabase only (server-side), so the PostHog funnels end at signup_completed,
// which the browser fires once the role step has written the profile.
const SIGNUP_INSIGHTS: InsightSpec[] = [
  {
    name: "Signup funnel — page to completed account",
    description:
      "Everyone who reached the signup page, who submitted it, and whose account finished being set up. Any signup source.",
    query: funnel([
      { id: "$pageview", name: "Signup page viewed", where: { $pathname: "/auth/signup" } },
      { id: "signup_form_submitted", name: "Form submitted" },
      { id: "signup_completed", name: "Account set up" },
    ]),
  },
  {
    name: "Signups per week by source",
    description:
      "Which surface each signup came from: the grid modal, the before-you-go prompt, or the signup page itself.",
    query: weeklyTrend([{ id: "signup_form_submitted" }], "source"),
  },
  {
    name: "Card-15 signup modal — funnel",
    description:
      "Shown after the 15th listing to signed-out visitors. Seen → picked a discipline → submitted the form → account set up.",
    query: funnel([
      { id: "opportunities_signup_modal_view", name: "Modal seen" },
      { id: "opportunities_signup_modal_first_pick", name: "Picked a discipline" },
      { id: "signup_form_submitted", name: "Submitted", where: { source: GRID_MODAL } },
      { id: "signup_completed", name: "Account set up" },
    ]),
  },
  {
    name: "Card-15 signup modal — seen, picked, dismissed, suppressed",
    description:
      "Suppressed = would have shown but the visitor dismissed it within the last 7 days. A high dismissed count with few picks means the ask lands too early.",
    query: trend(
      [
        { id: "opportunities_signup_modal_view", name: "Seen" },
        { id: "opportunities_signup_modal_first_pick", name: "Picked a discipline" },
        { id: "opportunities_signup_modal_dismissed", name: "Dismissed" },
        { id: "opportunities_signup_modal_suppressed", name: "Suppressed (recently dismissed)" },
      ],
      { interval: "week" }
    ),
  },
  {
    name: "Before-you-go prompt — funnel",
    description:
      "Shown on the Patronage tab left behind after a signed-out visitor clicks an external Apply link. Shown → submitted the form → account set up.",
    query: funnel([
      { id: "before_you_go_modal_shown", name: "Prompt shown" },
      { id: "signup_form_submitted", name: "Submitted", where: { source: BEFORE_YOU_GO } },
      { id: "signup_completed", name: "Account set up" },
    ]),
  },
  {
    name: "Before-you-go prompt — shown, dismissed, suppressed",
    description:
      "Dismissals split by had_picked show whether people engaged with the discipline chips before closing it.",
    query: trend(
      [
        { id: "before_you_go_modal_shown", name: "Shown" },
        { id: "before_you_go_modal_dismissed", name: "Dismissed" },
        { id: "before_you_go_modal_suppressed", name: "Suppressed (recently dismissed)" },
      ],
      { interval: "week" }
    ),
  },
  {
    name: "Before-you-go dismissals — picked a discipline first?",
    description: "had_picked = true means they engaged with the prompt before closing it.",
    query: trend([{ id: "before_you_go_modal_dismissed" }], {
      breakdown: "had_picked",
      interval: "week",
    }),
  },
  {
    name: "Signups blocked by reason",
    description:
      "Server-side rejections. tor, gibberish_name and dot_trick_email are bots being caught. If turnstile_failed or too_fast climb while signups fall, a rule may be catching real people.",
    query: trend([{ id: "signup_blocked" }], {
      breakdown: "reason",
      interval: "day",
      dateFrom: "-30d",
    }),
  },
  {
    name: "Other forms blocked (Tor)",
    description:
      "Partner enquiry, bug report and opportunity tip submissions rejected for arriving from a Tor exit.",
    query: trend([{ id: "form_blocked" }], {
      breakdown: "form",
      interval: "day",
      dateFrom: "-30d",
    }),
  },
];

const DASHBOARDS: DashboardSpec[] = [
  {
    name: "Growth Loops",
    description:
      "Which public objects acquire users: shares, referrals, signup prompts, regional pages, and the weekly digest.",
    insights: GROWTH_INSIGHTS,
  },
  {
    name: "Signup, prompts & bot protection",
    description:
      "The signup funnel, the card-15 and before-you-go prompts, and what the bot guards are blocking. Baseline: 10 Sep 2026.",
    insights: SIGNUP_INSIGHTS,
  },
];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface Listed {
  results: Array<{ id: number; name: string }>;
}

async function ensureDashboard(spec: DashboardSpec): Promise<void> {
  // Reuse an existing dashboard of the same name so re-running does not litter.
  const existing = await api<Listed>(`/dashboards/?search=${encodeURIComponent(spec.name)}`);
  let dashboard = existing.results.find((d) => d.name === spec.name);

  if (dashboard) {
    console.log(`Reusing dashboard #${dashboard.id} "${spec.name}".`);
  } else {
    dashboard = await api<{ id: number; name: string }>("/dashboards/", {
      method: "POST",
      body: JSON.stringify({ name: spec.name, description: spec.description }),
    });
    console.log(`Created dashboard #${dashboard.id} "${spec.name}".`);
  }

  const onDashboard = await api<Listed>(`/insights/?dashboard=${dashboard.id}&limit=100`);

  for (const insight of spec.insights) {
    if (onDashboard.results.some((i) => i.name === insight.name)) {
      console.log(`  skip   ${insight.name} (already present)`);
      continue;
    }

    await api("/insights/", {
      method: "POST",
      body: JSON.stringify({
        name: insight.name,
        description: insight.description,
        query: insight.query,
        dashboards: [dashboard.id],
      }),
    });
    console.log(`  added  ${insight.name}`);
  }

  console.log(`  → ${HOST}/project/${PROJECT_ID}/dashboard/${dashboard.id}\n`);
}

async function main() {
  if (!API_KEY || !PROJECT_ID) {
    console.error(
      "Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID. See the comment at the top of this file."
    );
    process.exit(1);
  }

  for (const dashboard of DASHBOARDS) {
    await ensureDashboard(dashboard);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
