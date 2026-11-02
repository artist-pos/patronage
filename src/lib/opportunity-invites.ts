const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** An organisation has invited an artist to apply (224). Says nothing about shortlists. */
export function buildOpportunityInviteEmail(opts: {
  artistName: string;
  orgName: string;
  title: string;
  deadline: string | null;
  href: string;
}): { subject: string; html: string } {
  const { artistName, orgName, title, deadline, href } = opts;
  const url = `${SITE_URL}${href}?utm_source=invite&utm_medium=email&utm_campaign=invite_to_apply`;
  const closes = deadline
    ? new Date(`${deadline}T00:00:00Z`).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;

  const subject = `${orgName} invited you to apply: ${title}`;
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#fff;color:#000;max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px;">Patronage</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">Kia ora ${esc(artistName)},</p>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
    <strong>${esc(orgName)}</strong> would like you to apply for <strong>${esc(title)}</strong>.
  </p>
  ${closes ? `<p style="margin:0 0 24px;font-size:13px;color:#666;font-family:ui-monospace,monospace;">Closes ${esc(closes)}</p>` : ""}
  <p style="margin:0 0 32px;">
    <a href="${url}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;font-weight:600;">See the opportunity</a>
  </p>
  <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">
    An invitation isn't a selection. The usual application process applies.
  </p>
</body></html>`;
  return { subject, html };
}
