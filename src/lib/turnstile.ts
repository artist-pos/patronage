/**
 * Verifies a Cloudflare Turnstile token server-side. Returns true when
 * TURNSTILE_SECRET_KEY isn't set (local/dev without keys configured), when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing (the widget can never have
 * rendered client-side, so every submission would arrive tokenless and get
 * permanently rejected — a config gap, not a failed human), and when
 * Cloudflare's endpoint itself is unreachable — none of these should be the
 * reason a real signup or enquiry gets blocked.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch (err) {
    console.error("turnstile verify failed:", err);
    return true;
  }
}
