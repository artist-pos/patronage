import { Resend } from "resend";
import { COPY, fill } from "@/lib/rabobank/artist-copy";

const FROM = process.env.RESEND_FROM ?? "Patronage <noreply@patronage.nz>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const linkify = (html: string) =>
  html.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" style="color:#1c1917">${u}</a>`);

/** Plain, light layout matching Patronage emails. Copy bodies carry their own greeting and links. */
function layout(body: string): string {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${linkify(esc(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#fafaf9">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1917">
${paras}
<p style="margin:24px 0 0;color:#78716c">${esc(COPY.email.signoff)}</p>
</div></body></html>`;
}

const text = (body: string) => `${body}\n\n${COPY.email.signoff}`;
const choiceUrl = (token: string, c: "keep" | "delete") => `${SITE_URL}/partners/rabobank/artists/${token}/choice?c=${c}`;

type Followup = { to: string; firstName: string; token: string; deleteDate: string };

/** At selection close: keep the profile, or delete it? Each link confirms on a page. */
export async function sendFollowup(p: Followup) {
  const body = fill(COPY.email.followupBody, {
    firstName: p.firstName, deleteDate: p.deleteDate, keepLink: choiceUrl(p.token, "keep"), deleteLink: choiceUrl(p.token, "delete"),
  });
  await getResend().emails.send({ from: FROM, to: p.to, subject: COPY.email.followupSubject, html: layout(body), text: text(body) });
}

/** Day 21: the one reminder before deletion at day 30. */
export async function sendReminder(p: Followup) {
  const body = fill(COPY.email.reminderBody, {
    firstName: p.firstName, deleteDate: p.deleteDate, keepLink: choiceUrl(p.token, "keep"), deleteLink: choiceUrl(p.token, "delete"),
  });
  await getResend().emails.send({ from: FROM, to: p.to, subject: COPY.email.reminderSubject, html: layout(body), text: text(body) });
}

/** The sign-in link that turns their Rabobank profile into a Patronage profile. */
export async function sendKeepLink(p: { to: string; firstName: string; link: string }) {
  const body = fill(COPY.email.keepBody, { firstName: p.firstName, signInLink: p.link });
  await getResend().emails.send({ from: FROM, to: p.to, subject: COPY.email.keepSubject, html: layout(body), text: text(body) });
}
