/**
 * Creates the "Growth Loops" dashboard in PostHog.
 *
 * Run once, after the growth-sprint events have started arriving:
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

const DASHBOARD_NAME = "Growth Loops";

interface InsightSpec {
  name: string;
  description: string;
  query: Record<string, unknown>;
}

/** A weekly trend of one or more events, optionally broken down by a property. */
function weeklyTrend(
  events: Array<{ id: string; name?: string }>,
  breakdown?: string
): Record<string, unknown> {
  return {
    kind: "InsightVizNode",
    source: {
      kind: "TrendsQuery",
      dateRange: { date_from: "-90d" },
      interval: "week",
      series: events.map((e) => ({
        kind: "EventsNode",
        event: e.id,
        name: e.name ?? e.id,
        math: "total",
      })),
      trendsFilter: { display: "ActionsLineGraph" },
      ...(breakdown && {
        breakdownFilter: { breakdown_type: "event", breakdown },
      }),
    },
  };
}

const INSIGHTS: InsightSpec[] = [
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

async function main() {
  if (!API_KEY || !PROJECT_ID) {
    console.error(
      "Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID. See the comment at the top of this file."
    );
    process.exit(1);
  }

  // Reuse an existing dashboard of the same name so re-running does not litter.
  const existing = await api<Listed>(`/dashboards/?search=${encodeURIComponent(DASHBOARD_NAME)}`);
  let dashboard = existing.results.find((d) => d.name === DASHBOARD_NAME);

  if (dashboard) {
    console.log(`Reusing dashboard #${dashboard.id} "${DASHBOARD_NAME}".`);
  } else {
    dashboard = await api<{ id: number; name: string }>("/dashboards/", {
      method: "POST",
      body: JSON.stringify({
        name: DASHBOARD_NAME,
        description:
          "Which public objects acquire users: shares, referrals, signup prompts, regional pages, and the weekly digest.",
      }),
    });
    console.log(`Created dashboard #${dashboard.id} "${DASHBOARD_NAME}".`);
  }

  const onDashboard = await api<Listed>(`/insights/?dashboard=${dashboard.id}&limit=100`);

  for (const spec of INSIGHTS) {
    if (onDashboard.results.some((i) => i.name === spec.name)) {
      console.log(`  skip   ${spec.name} (already present)`);
      continue;
    }

    await api("/insights/", {
      method: "POST",
      body: JSON.stringify({
        name: spec.name,
        description: spec.description,
        query: spec.query,
        dashboards: [dashboard.id],
      }),
    });
    console.log(`  added  ${spec.name}`);
  }

  console.log(`\nDone: ${HOST}/project/${PROJECT_ID}/dashboard/${dashboard.id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
