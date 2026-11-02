const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export interface OutcomePromptItem {
  title: string;
  organiser: string;
  href: string; // the report page, /opportunities/<slug>/outcome
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Six weeks after a deadline: "did you apply, and how did it go?" (226). */
export function buildOutcomePromptEmail(opts: {
  items: OutcomePromptItem[];
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const { items, unsubscribeToken } = opts;
  const subject =
    items.length === 1
      ? `How did ${items[0].title} go?`
      : `How did ${items.length} opportunities you saved go?`;

  const rows = items
    .map((i) => {
      const url = `${SITE_URL}${i.href}?utm_source=outcome_prompt&utm_medium=email&utm_campaign=outcome`;
      return `
      <tr><td style="padding:16px 0;border-top:1px solid #e5e5e5;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;">${esc(i.organiser)}</p>
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;line-height:1.35;">${esc(i.title)}</p>
        <a href="${url}" style="font-size:13px;color:#000;">Share how it went &rarr;</a>
      </td></tr>`;
    })
    .join("");

  const unsubscribe = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&list=reminders`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#fff;color:#000;max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px;">Patronage</h1>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.55;">
    You saved ${items.length === 1 ? "this opportunity" : "these opportunities"}, and the deadline has passed.
    Did you apply, and did you hear back? It takes under a minute.
  </p>
  <p style="margin:0 0 8px;font-size:14px;color:#444;line-height:1.55;">
    Other artists see only totals, such as how many heard back and how long it took, never who answered.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;">${rows}</table>
  <p style="margin:0 0 4px;font-size:12px;color:#888;line-height:1.5;">
    You're getting this because you saved ${items.length === 1 ? "this listing" : "these listings"} on Patronage.
    <a href="${unsubscribe}" style="color:#888;">Stop emails about saved opportunities</a>.
  </p>
</body></html>`;

  return { subject, html };
}
