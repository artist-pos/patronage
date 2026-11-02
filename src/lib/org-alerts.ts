const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export interface OrgAlertItem {
  title: string;
  organiser: string;
  type: string;
  deadline: string | null; // YYYY-MM-DD
  href: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function formatDeadline(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** One email per follower, however many new listings their organisations posted (223). */
export function buildOrgAlertEmail(opts: {
  items: OrgAlertItem[];
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const { items, unsubscribeToken } = opts;
  const organisers = [...new Set(items.map((i) => i.organiser))];
  const subject =
    items.length === 1
      ? `New from ${items[0].organiser}: ${items[0].title}`
      : organisers.length === 1
        ? `${items.length} new opportunities from ${organisers[0]}`
        : `${items.length} new opportunities from organisations you follow`;

  const rows = items
    .map((i) => {
      const url = `${SITE_URL}${i.href}?utm_source=org_alert&utm_medium=email&utm_campaign=org_follow`;
      const meta = [i.type, i.deadline ? `Closes ${formatDeadline(i.deadline)}` : null].filter(Boolean).join(" · ");
      return `
      <tr><td style="padding:16px 0;border-top:1px solid #e5e5e5;">
        <p style="margin:0 0 4px;font-size:13px;color:#666;">${esc(i.organiser)}</p>
        <p style="margin:0 0 4px;font-size:16px;font-weight:600;line-height:1.35;">
          <a href="${url}" style="color:#000;text-decoration:none;">${esc(i.title)}</a>
        </p>
        ${meta ? `<p style="margin:0;font-size:12px;color:#666;font-family:ui-monospace,monospace;">${esc(meta)}</p>` : ""}
      </td></tr>`;
    })
    .join("");

  const unsubscribe = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&list=alerts`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#fff;color:#000;max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px;">Patronage</h1>
  <p style="margin:0 0 8px;font-size:15px;line-height:1.55;">
    ${organisers.length === 1 ? esc(organisers[0]) : "Organisations you follow"} just posted ${items.length === 1 ? "an opportunity" : "new opportunities"}:
  </p>
  <table style="width:100%;border-collapse:collapse;margin:8px 0 24px;">${rows}</table>
  <p style="margin:0 0 4px;font-size:12px;color:#888;line-height:1.5;">
    You're getting this because you follow ${organisers.length === 1 ? "this organisation" : "these organisations"} on Patronage.
    <a href="${unsubscribe}" style="color:#888;">Stop these alerts</a>.
  </p>
</body></html>`;

  return { subject, html };
}
