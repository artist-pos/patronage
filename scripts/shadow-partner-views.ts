/**
 * Which unclaimed (shadow) partner pages are getting visitors, for claim outreach:
 * "your page was viewed N times this month" is the opening line.
 *
 *   POSTHOG_PERSONAL_API_KEY=phx_... POSTHOG_PROJECT_ID=12345 \
 *     npm run posthog:shadow-views [-- 30]
 *
 * Needs a key with "Query: read". profile_view carries `unclaimed` from the day
 * this shipped, so earlier views are not counted. The optional argument is the
 * window in days (default 30).
 */

export {};

const HOST = process.env.POSTHOG_HOST ?? "https://us.posthog.com";
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const DAYS = Math.max(1, Math.min(365, Number(process.argv[2]) || 30));

async function main() {
  if (!API_KEY || !PROJECT_ID) {
    console.error("Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID. See the comment at the top of this file.");
    process.exit(1);
  }

  const query = `
    select properties.username as username,
           count() as views,
           count(distinct person_id) as visitors,
           countIf(event = 'partner_enquire_click') as enquire_clicks
    from events
    where event in ('profile_view', 'partner_enquire_click')
      and properties.unclaimed = 'true'
      and properties.profile_role = 'partner'
      and timestamp > now() - interval ${DAYS} day
    group by username
    order by visitors desc
    limit 50`;

  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

  const { results } = (await res.json()) as { results: Array<[string, number, number, number]> };
  if (results.length === 0) {
    console.log(`No unclaimed partner page views in the last ${DAYS} days yet.`);
    return;
  }

  console.log(`Unclaimed partner pages, last ${DAYS} days\n`);
  console.log("username".padEnd(36), "visitors".padStart(9), "views".padStart(7), "enquiries".padStart(10));
  for (const [username, views, visitors, enquiries] of results) {
    console.log(String(username).padEnd(36), String(visitors).padStart(9), String(views).padStart(7), String(enquiries).padStart(10));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
