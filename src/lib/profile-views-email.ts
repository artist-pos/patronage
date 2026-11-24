const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

/** Below this many views in a week there is nothing worth a Monday email. */
export const MIN_WEEKLY_VIEWS = 3;

/** How many weekly emails carry the profile before-and-after. Past this, more
 *  nudging won't change anything. */
export const MAX_COMPARISON_WEEKS = 3;

export interface WeeklyProfileStats {
  views: number;
  prevViews: number;
  cvClicks: number;
  websiteClicks: number;
  artworkViews: number;
  /** Appreciations of their studio updates this week (225). */
  appreciations: number;
  /** Saves of their work to other people's boards this week (224); shortlists excluded. */
  saves: number;
}

/** Worth a Monday email: enough views, or anyone appreciated or saved their work. */
export function hasWeeklyNews(s: WeeklyProfileStats): boolean {
  return s.views >= MIN_WEEKLY_VIEWS || s.appreciations > 0 || s.saves > 0;
}

const times = (n: number) => `${n} time${n === 1 ? "" : "s"}`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Profile before-and-after ─────────────────────────────────────────────────
// A small, email-safe picture of a profile: who they are, their bio, and their
// first three works. Built from the artist's real fields so "now" is exactly
// what a visitor sees, and "after" is the same page with the gaps filled.

const INK = "#0a0a0a";
const MUTED = "#6c6c6c";
const SUBTLE = "#8f8f8f";
const RULE = "#e1e1e1";
const BRAND = "#005a56";
const BRAND_SUB = "#e7f5f4";
const BEIGE = "#f1efe9";
const PAPER = "#FAFAF9";
// Same type stack as the weekly digest, so every Patronage email reads as one family.
const SANS = "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace";

/** The shared frame: warm paper, masthead, mono kicker over an ink rule, hairline footer. */
function emailShell(opts: { kicker: string; body: string; footer: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:${PAPER};">
    <tr>
      <td align="center" style="padding:40px 24px;">
        <table width="552" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:552px;width:100%;">
          <tr>
            <td style="padding:0 0 6px;">
              <a href="${SITE_URL}" style="text-decoration:none;"><span style="font-family:${SANS};font-size:17px;font-weight:600;letter-spacing:-.01em;color:${INK};">Patronage</span></a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 20px;border-bottom:1px solid ${INK};">
              <p style="margin:0;font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${SUBTLE};">${esc(opts.kicker)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 0 0;font-family:${SANS};color:${INK};">
              ${opts.body}
            </td>
          </tr>
          <tr>
            <td style="padding:30px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-top:1px solid ${RULE};">
                <tr>
                  <td style="padding:18px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${SUBTLE};">
                    ${opts.footer}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface ProfileSnapshot {
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  disciplines: string[];
  location: string | null;
  /** Image URLs of up to three works. */
  works: string[];
  /** Parts of this snapshot that are placeholders for what the artist could add. */
  placeholder?: { bio?: boolean; avatar?: boolean; works?: number };
}

const absImage = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null);

const SAMPLE_BIO = "Your bio goes here: a few lines on what you make, where you work and what you're after.";

/** The same profile with its gaps filled. With a real example profile, that is
 *  shown instead, so the comparison is a genuine page and not a mock-up. */
export function afterSnapshot(now: ProfileSnapshot, example: ProfileSnapshot | null): ProfileSnapshot {
  if (example) return example;
  return {
    ...now,
    bio: now.bio?.trim() ? now.bio : SAMPLE_BIO,
    placeholder: {
      bio: !now.bio?.trim(),
      avatar: !now.avatarUrl,
      works: Math.max(0, 3 - now.works.length),
    },
  };
}

/** Height of a work tile. The card is ~518px inside its border and padding, so a
 *  third of it (less the gaps) is about this wide: close enough to square. */
const TILE = 165;

/** A bio for the card: whitespace collapsed, and if long, cut at the end of a
 *  sentence (or failing that a word) so it never stops mid-thought. */
function clipBio(bio: string | null): string | null {
  const text = bio?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= 170) return text;
  const head = text.slice(0, 200);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentenceEnd >= 60) return head.slice(0, sentenceEnd + 1);
  return `${text.slice(0, 170).replace(/\s+\S*$/, "")}…`;
}

function profileCardHtml(p: ProfileSnapshot, opts: { label: string; tone: "now" | "after" }): string {
  const avatar = absImage(p.avatarUrl);
  const initial = esc((p.name.trim()[0] ?? "?").toUpperCase());
  const ghostAvatar = !avatar && !!p.placeholder?.avatar;
  const meta = [p.disciplines.slice(0, 2).join(" · "), p.location].filter(Boolean).join(" · ");
  const border = opts.tone === "after" ? BRAND : RULE;

  const avatarCell = avatar
    ? `<img src="${esc(avatar)}" alt="" width="52" height="52" style="display:block;width:52px;height:52px;object-fit:cover;border:0;background:${BEIGE};">`
    : `<div style="width:52px;height:52px;background:${ghostAvatar ? BRAND_SUB : BEIGE};${ghostAvatar ? `border:1px dashed ${BRAND};` : ""}text-align:center;line-height:${ghostAvatar ? 50 : 52}px;font-family:${SANS};font-size:20px;color:${ghostAvatar ? BRAND : SUBTLE};">${ghostAvatar ? "+" : initial}</div>`;

  const bioText = clipBio(p.bio);
  const bioHtml = bioText
    ? `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:1.55;color:${p.placeholder?.bio ? BRAND : INK};${p.placeholder?.bio ? "font-style:italic;" : ""}">${esc(bioText)}</p>`
    : `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:1.55;color:${SUBTLE};">No bio yet.</p>`;

  const ghostWorks = p.placeholder?.works ?? 0;
  const tiles = [0, 1, 2].map((i) => {
    const src = absImage(p.works[i] ?? null);
    const isGhost = !src && i >= 3 - ghostWorks;
    // Every slot, filled or empty, is the same box (TILE px tall, the width of a
    // third of the card), so a profile with no work lines up exactly with one that
    // has it. An empty slot is a quiet grey tile with a faint frame, no words.
    const inner = src
      ? `<img src="${esc(src)}" alt="" width="${TILE}" height="${TILE}" style="display:block;width:100%;height:${TILE}px;object-fit:cover;border:0;background:${BEIGE};">`
      : isGhost
        ? `<div style="height:${TILE}px;background:${BRAND_SUB};border:1px dashed ${BRAND};box-sizing:border-box;text-align:center;line-height:${TILE - 2}px;font-family:${SANS};font-size:12px;color:${BRAND};">Your work</div>`
        : `<div style="height:${TILE - 71}px;padding-top:71px;background:${BEIGE};"><div style="width:30px;height:22px;margin:0 auto;border:1px solid #c9c6bd;"></div></div>`;
    return `<td width="33%" style="padding:${i === 0 ? "0 8px 0 0" : i === 2 ? "0 0 0 8px" : "0 4px"};vertical-align:top;">${inner}</td>`;
  });

  return `
  <p style="margin:0 0 6px;font-family:${MONO};font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:${opts.tone === "after" ? BRAND : SUBTLE};">${esc(opts.label)}</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border:1px solid ${border};background:#ffffff;">
    <tr><td style="padding:16px;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation"><tr>
        <td style="vertical-align:middle;padding:0 12px 0 0;">${avatarCell}</td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-family:${SANS};font-size:15px;font-weight:600;color:${INK};">${esc(p.name)}</p>
          ${meta ? `<p style="margin:2px 0 0;font-family:${SANS};font-size:12px;color:${MUTED};">${esc(meta)}</p>` : ""}
        </td>
      </tr></table>
      ${bioHtml}
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:14px;"><tr>${tiles.join("")}</tr></table>
    </td></tr>
  </table>`;
}

export interface ProfileComparison {
  now: ProfileSnapshot;
  after: ProfileSnapshot;
  /** What's missing, in words ("a bio", "2 more works"). */
  missing: string[];
  /** Set when "after" is a real example profile, so it can be linked. */
  exampleUrl?: string | null;
}

function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The one next step, chosen from what the profile is actually missing. A single
 *  small ask gets done; a list of everything missing gets put off. */
function firstStep(now: ProfileSnapshot): { label: string; href: string } {
  if (!now.bio?.trim()) return { label: "Add a two-line bio", href: "/profile/edit" };
  if (!now.avatarUrl) return { label: "Add a profile photo", href: "/profile/edit" };
  return { label: now.works.length === 0 ? "Add your first work" : "Add another work", href: "/studio/works/new" };
}

/** A note from Blake: why a finished profile matters, and what he's working on.
 *  It's news, so it appears once per person, in the first-look email only.
 *  Update this when the news changes. */
const FOUNDER_NOTE = [
  "A recent commission for a bank was almost lost because staff weren't convinced they wanted an artwork. That changed when they could read about the artist, understand their practice and picture the work in their space.",
  "A good profile helps people see the person behind the work, and gives them a reason to get in touch.",
];

function founderNoteHtml(): string {
  return `
  <div style="margin:22px 0 4px;border-left:3px solid ${BRAND};padding:2px 0 2px 16px;">
    ${FOUNDER_NOTE.map((p) => `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.6;color:${INK};">${esc(p)}</p>`).join("")}
    <p style="margin:0;font-family:${SANS};font-size:14px;color:${MUTED};">Blake</p>
  </div>`;
}

/** A button with a Google G, so it reads as a thing to do. */
function googleButtonHtml(label: string, url: string, margin: string): string {
  return `
  <p style="margin:${margin};">
    <a href="${esc(url)}" style="display:inline-block;border:1px solid #dadce0;background:#fff;color:#3c4043;padding:8px 14px 8px 10px;font-family:${SANS};font-size:13px;text-decoration:none;">
      <span style="display:inline-block;width:20px;height:20px;line-height:20px;text-align:center;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#4285F4;vertical-align:middle;margin-right:8px;">G</span><span style="vertical-align:middle;">${esc(label)}</span>
    </a>
  </p>`;
}

/** "Go on, Google yourself": a Google search for the artist's own name. */
function googleSearchHtml(fullName: string | null): string {
  const name = (fullName ?? "").trim();
  if (!name) return "";
  return googleButtonHtml("Go on, Google yourself", `https://www.google.com/search?q=${encodeURIComponent(`"${name}"`)}`, "18px 0 0");
}

/** Where "Google Blake" goes. It's a joke, and a video, so it isn't a search. */
const GOOGLE_BLAKE_URL = "https://www.youtube.com/watch?v=Aq5WXmQQooo";

/** The example profile is the founder's own (PROFILE_EXAMPLE_USERNAME), and the
 *  note under it is signed by him, so the label owns it. If the example is ever
 *  someone else's profile, drop this. */
const EXAMPLE_SUFFIX = " (me lol)";

function comparisonHtml(
  c: ProfileComparison,
  lead: string,
  searchName: string | null,
  opts: { note: boolean },
): string {
  const afterLabel = c.after.placeholder
    ? `With ${joinWords(c.missing)}`
    : `For comparison: ${c.after.name}${EXAMPLE_SUFFIX}`;
  const exampleLink = c.exampleUrl
    ? `${googleButtonHtml("Google Blake", GOOGLE_BLAKE_URL, "14px 0 0")}
  <p style="margin:10px 0 0;font-family:${SANS};font-size:12px;"><a href="${esc(c.exampleUrl)}" style="color:${MUTED};">See this profile &rarr;</a></p>`
    : "";
  const step = firstStep(c.now);
  return `
  ${lead ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${MUTED};">${esc(lead)}</p>` : ""}
  ${googleSearchHtml(searchName).replace("margin:18px 0 0;", "margin:0 0 28px;")}
  ${profileCardHtml(c.now, { label: "What they see now", tone: "now" })}
  <div style="height:18px;line-height:18px;">&nbsp;</div>
  ${profileCardHtml(c.after, { label: afterLabel, tone: "after" })}
  ${exampleLink}
  ${opts.note ? founderNoteHtml() : ""}
  <p style="margin:18px 0 22px;font-size:14px;line-height:1.55;">
    <a href="${SITE_URL}${step.href}" style="display:inline-block;background:${INK};color:#fff;padding:10px 20px;font-size:14px;text-decoration:none;">${esc(step.label)}</a>
  </p>`;
}

/** One suggestion, chosen from what the profile is actually missing. Used when no comparison is shown. */
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

// ── The weekly email ─────────────────────────────────────────────────────────

export function buildProfileViewsEmail(opts: {
  name: string | null;
  username: string;
  stats: WeeklyProfileStats;
  hasBio: boolean;
  hasAvatar: boolean;
  unsubscribeToken: string;
  /** Present while the profile has a gap and the comparison hasn't run its course. */
  comparison?: ProfileComparison | null;
}): { subject: string; html: string } {
  const { stats, username } = opts;
  const first = (opts.name ?? "").trim().split(/\s+/)[0];
  const profileUrl = `${SITE_URL}/${username}?utm_source=profile_views&utm_medium=email&utm_campaign=weekly`;

  // Lead with what people did, not just what they looked at.
  const subject =
    stats.appreciations > 0
      ? `Your updates were appreciated ${times(stats.appreciations)} this week`
      : stats.saves > 0
        ? `Your work was saved ${times(stats.saves)} this week`
        : stats.views === 1
          ? "Your Patronage profile was viewed this week"
          : `Your Patronage profile was viewed ${stats.views} times this week`;

  const noticed: string[] = [];
  if (stats.appreciations > 0) noticed.push(`your studio updates were appreciated ${times(stats.appreciations)}`);
  if (stats.saves > 0) noticed.push(`your work was saved to people's boards ${times(stats.saves)}`);
  const showViews = stats.views >= MIN_WEEKLY_VIEWS;

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

  // The number gives the comparison its stakes; without it the old one-liner stands in.
  const step = opts.comparison ? null : nextStep({ hasBio: opts.hasBio, hasAvatar: opts.hasAvatar });
  const comparison = opts.comparison
    ? comparisonHtml(
        opts.comparison,
        showViews
          ? "Here's what those visits landed on, and what they could have."
          : "Here's what people land on when they find your profile, and what they could.",
        opts.name,
        // The note is news, and says it once: the first-look email only.
        { note: false },
      )
    : "";
  const unsubscribe = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}&list=views`;

  const body = `
  ${noticed.length
    ? `<p style="margin:0 0 8px;font-size:20px;font-weight:600;line-height:1.35;letter-spacing:-.01em;">${first ? `Kia ora ${esc(first)}, your` : "Your"} work is getting noticed.</p>
  <p style="margin:0 0 26px;font-size:15px;color:${MUTED};line-height:1.6;">Last week ${esc(noticed.join(", and "))}.</p>`
    : `<p style="margin:0 0 6px;font-size:15px;color:${MUTED};">${first ? `Kia ora ${esc(first)}, ` : ""}last week:</p>`}
  ${showViews ? `<p style="margin:0 0 4px;font-size:48px;font-weight:600;line-height:1.1;letter-spacing:-.02em;">${stats.views}</p>
  <p style="margin:0 0 22px;font-size:15px;color:${MUTED};">profile view${stats.views === 1 ? "" : "s"}${trend ? `. ${esc(trend)}` : ""}</p>` : ""}
  ${showViews && extras.length ? `<p style="margin:0 0 26px;font-size:14px;color:${MUTED};line-height:1.6;">Also: ${extras.map(esc).join(", ")}.</p>` : ""}
  ${comparison ? `<div style="border-top:1px solid ${RULE};padding-top:26px;">${comparison}</div>` : ""}
  ${step ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;">${esc(step.text)} <a href="${SITE_URL}${step.href}" style="color:${INK};">Open your profile settings</a></p>` : ""}
  ${opts.comparison
    ? `<p style="margin:0;font-size:13px;"><a href="${profileUrl}" style="color:${MUTED};text-decoration:underline;">See your profile &rarr;</a></p>`
    : `<p style="margin:0;"><a href="${profileUrl}" style="display:inline-block;background:${INK};color:#fff;padding:10px 20px;font-size:14px;font-weight:500;text-decoration:none;">See your profile &rarr;</a></p>`}`;

  const footer = `You get this on Mondays when people have appreciated or saved your work, or viewed your profile ${MIN_WEEKLY_VIEWS} or more times. Only you see these numbers. <a href="${unsubscribe}" style="color:${SUBTLE};">Stop these emails</a>.`;

  return { subject, html: emailShell({ kicker: "Your week on Patronage", body, footer }) };
}

// ── The first look, once ─────────────────────────────────────────────────────

/**
 * Sent once to a new artist whose profile has gaps and who hasn't had a
 * Monday email yet (no number to lead with). It says plainly what the profile
 * is: a public page, indexed by Google, and what people find when they look
 * the artist up.
 */
export function buildFirstLookEmail(opts: {
  name: string | null;
  username: string;
  comparison: ProfileComparison;
  unsubscribeToken: string;
}): { subject: string; html: string } {
  const first = (opts.name ?? "").trim().split(/\s+/)[0];
  const fullName = (opts.name ?? "").trim();
  const subject = "Have you Googled yourself lately?";
  const unsubscribe = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(opts.unsubscribeToken)}&list=views`;

  const body = `
  <p style="margin:0;font-size:24px;font-weight:600;line-height:1.3;letter-spacing:-.015em;">We've all done it.</p>
  <p style="margin:0 0 18px;font-size:24px;font-weight:400;line-height:1.3;letter-spacing:-.015em;">Have you Googled yourself lately?</p>
  <p style="margin:0 0 26px;font-size:15px;color:${MUTED};line-height:1.6;">People looking to work with you do it too. Here's what they find, and how your Patronage profile could make a better impression.</p>
  ${comparisonHtml(opts.comparison, "", fullName || null, { note: true })}
  <p style="margin:0;font-size:13px;"><a href="${SITE_URL}/${esc(opts.username)}?utm_source=first_look&utm_medium=email" style="color:${MUTED};text-decoration:underline;">See your profile &rarr;</a></p>`;

  const footer = `This is a one-off email. After this, you'll only hear from us on Mondays with updates about activity on your profile. <a href="${unsubscribe}" style="color:${SUBTLE};">Stop these emails</a>.`;

  return { subject, html: emailShell({ kicker: "Your profile", body, footer }) };
}
