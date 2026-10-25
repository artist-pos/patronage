const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export type ReminderWindow = "7d" | "2d";

export interface ReminderItem {
  window: ReminderWindow;
  title: string;
  organiser: string;
  deadline: string; // YYYY-MM-DD
  href: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Today's date in New Zealand as YYYY-MM-DD, plus `days`. Deadlines are NZ calendar dates. */
export function nzDatePlus(days: number): string {
  const now = new Date();
  const nz = new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland" }).format(now);
  const d = new Date(`${nz}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDeadline(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function buildDeadlineReminderEmail(opts: {
  items: ReminderItem[];
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const { items, unsubscribeToken } = opts;
  const urgent = items.some((i) => i.window === "2d");
  const subject =
    items.length === 1
      ? `${items[0].window === "2d" ? "Closes in 2 days" : "Closes in a week"}: ${items[0].title}`
      : `${items.length} opportunities you saved are closing soon`;

  const rows = items
    .map((i) => {
      const url = `${SITE_URL}${i.href}?utm_source=reminder&utm_medium=email&utm_campaign=deadline_${i.window}`;
      return `
      <tr><td style="padding:16px 0;border-top:1px solid #e5e5e5;">
        <p style="margin:0 0 4px;font-size:12px;color:${i.window === "2d" ? "#b42318" : "#666"};font-family:ui-monospace,monospace;">
          ${i.window === "2d" ? "Closes in 2 days" : "Closes in a week"} · ${esc(formatDeadline(i.deadline))}
        </p>
        <p style="margin:0 0 4px;font-size:16px;font-weight:600;line-height:1.35;">
          <a href="${url}" style="color:#000;text-decoration:none;">${esc(i.title)}</a>
        </p>
        <p style="margin:0;font-size:13px;color:#666;">${esc(i.organiser)}</p>
      </td></tr>`;
    })
    .join("");

  const unsubscribe = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&list=reminders`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#fff;color:#000;max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px;">Patronage</h1>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.55;">
    ${urgent ? "Not much time left on" : "A heads-up about"} ${items.length === 1 ? "an opportunity" : "opportunities"} you saved:
  </p>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;">${rows}</table>
  <p style="margin:0 0 4px;font-size:12px;color:#888;line-height:1.5;">
    You're getting this because you saved ${items.length === 1 ? "this listing" : "these listings"} on Patronage.
    <a href="${unsubscribe}" style="color:#888;">Stop deadline reminders</a>.
  </p>
</body></html>`;

  return { subject, html };
}
