const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/** Below this many views in a week there is nothing worth a Monday email. */
export const MIN_WEEKLY_VIEWS = 3;

export interface WeeklyProfileStats {
  views: number;
  prevViews: number;
  cvClicks: number;
  websiteClicks: number;
  artworkViews: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One suggestion, chosen from what the profile is actually missing. */
function nextStep(opts: { hasBio: boolean; hasAvatar: boolean }): { text: string; href: string } | null {
  if (!opts.hasBio) {
    return {
      text: "You don't have a bio yet. It's the first thing people look for, and it takes a couple of minutes.",
      href: "/profile/edit",
    };
  }
  if (!opts.hasAvatar) {
    return { text: "Add a profile photo so people recognise you when they land.", href: "/profile/edit" };
  }
  return null;
}

export function buildProfileViewsEmail(opts: {
  name: string | null;
  username: string;
  stats: WeeklyProfileStats;
  hasBio: boolean;
  hasAvatar: boolean;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const { stats, username } = opts;
  const first = (opts.name ?? "").trim().split(/\s+/)[0];
  const profileUrl = `${SITE_URL}/${username}?utm_source=profile_views&utm_medium=email&utm_campaign=weekly`;

  const subject =
    stats.views === 1
      ? "Your Patronage profile was viewed this week"
      : `Your Patronage profile was viewed ${stats.views} times this week`;

  let trend = "";
  if (stats.prevViews > 0) {
    const diff = stats.views - stats.prevViews;
    if (diff > 0) trend = `Up ${diff} on the week before.`;
    else if (diff < 0) trend = `Down ${-diff} on the week before.`;
    else trend = "The same as the week before.";
  }

  const extras: string[] = [];
  if (stats.artworkViews > 0) extras.push(`${stats.artworkViews} view${stats.artworkViews === 1 ? "" : "s"} of your work`);
  if (stats.cvClicks > 0) extras.push(`${stats.cvClicks} CV click${stats.cvClicks === 1 ? "" : "s"}`);
  if (stats.websiteClicks > 0) extras.push(`${stats.websiteClicks} click${stats.websiteClicks === 1 ? "" : "s"} through to your website`);

  const step = nextStep({ hasBio: opts.hasBio, hasAvatar: opts.hasAvatar });
  const unsubscribe = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}&list=views`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;background:#fff;color:#000;max-width:560px;margin:0 auto;padding:40px 24px;">
  <h1 style="font-size:20px;font-weight:600;margin:0 0 24px;">Patronage</h1>
  <p style="margin:0 0 4px;font-size:15px;">${first ? `Kia ora ${esc(first)}, ` : ""}last week:</p>
  <p style="margin:0 0 4px;font-size:44px;font-weight:600;line-height:1.1;">${stats.views}</p>
  <p style="margin:0 0 20px;font-size:15px;color:#444;">profile view${stats.views === 1 ? "" : "s"}${trend ? `. ${esc(trend)}` : ""}</p>
  ${extras.length ? `<p style="margin:0 0 20px;font-size:14px;color:#444;line-height:1.55;">Also: ${extras.map(esc).join(", ")}.</p>` : ""}
  ${step ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.55;">${esc(step.text)} <a href="${SITE_URL}${step.href}" style="color:#000;">Open your profile settings</a></p>` : ""}
  <a href="${profileUrl}" style="display:inline-block;background:#000;color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">See your profile &rarr;</a>
  <p style="margin:32px 0 0;font-size:12px;color:#888;line-height:1.5;">
    You get this on Mondays when your profile has been viewed ${MIN_WEEKLY_VIEWS} or more times.
    <a href="${unsubscribe}" style="color:#888;">Stop these emails</a>.
  </p>
</body></html>`;

  return { subject, html };
}
