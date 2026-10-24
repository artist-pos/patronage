import { Resend } from "resend";
import { COPY } from "@/lib/rabobank/artist-copy";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Plain, light layout matching Patronage emails: black ink, stone text, black buttons. */
function layout(body: string, buttons: { href: string; label: string; quiet?: boolean }[]): string {
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const btns = buttons
    .map((b) => b.quiet
      ? `<a href="${b.href}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:8px;border:1px solid #a8a29e;color:#1c1917;text-decoration:none;font-weight:500">${esc(b.label)}</a>`
      : `<a href="${b.href}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border-radius:8px;background:#000;color:#fff;text-decoration:none;font-weight:500">${esc(b.label)}</a>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#fafaf9">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1917">
${paras}
<div style="margin:24px 0">${btns}</div>
<p style="margin:24px 0 0;color:#78716c">${esc(COPY.email.signoff)}</p>
</div></body></html>`;
}

const choiceUrl = (token: string, c: "keep" | "delete") => `${SITE_URL}/partners/rabobank/artists/${token}/choice?c=${c}`;

/** At selection close: keep the profile, or delete it? Two one-click links (each confirms on a page). */
export async function sendFollowup(p: { to: string; firstName: string; token: string }) {
  await getResend().emails.send({
    from: FROM,
    to: p.to,
    subject: COPY.email.followupSubject,
    html: layout(`Kia ora ${p.firstName},\n\n${COPY.email.followupBody}`, [
      { href: choiceUrl(p.token, "keep"), label: COPY.followup.keepButton },
      { href: choiceUrl(p.token, "delete"), label: COPY.followup.deleteButton, quiet: true },
    ]),
  });
}

/** Day 21: the one reminder before deletion at day 30. */
export async function sendReminder(p: { to: string; firstName: string; token: string }) {
  await getResend().emails.send({
    from: FROM,
    to: p.to,
    subject: COPY.email.reminderSubject,
    html: layout(`Kia ora ${p.firstName},\n\n${COPY.email.reminderBody}`, [
      { href: choiceUrl(p.token, "keep"), label: COPY.followup.keepButton },
      { href: choiceUrl(p.token, "delete"), label: COPY.followup.deleteButton, quiet: true },
    ]),
  });
}

/** The sign-in link that turns their Rabobank profile into a Patronage profile. */
export async function sendKeepLink(p: { to: string; firstName: string; link: string }) {
  await getResend().emails.send({
    from: FROM,
    to: p.to,
    subject: COPY.email.keepSubject,
    html: layout(`Kia ora ${p.firstName},\n\n${COPY.email.keepBody}`, [{ href: p.link, label: COPY.keep.button }]),
  });
}
