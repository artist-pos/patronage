/**
 * Minimum time between a form rendering and its submission. Scripted bots —
 * including ones that solve the Turnstile challenge via a solving service —
 * tend to fill and submit within a few hundred ms; real people don't.
 * Stacks on top of honeypot/Turnstile/rate-limit as a cheap extra signal.
 */
const MIN_FORM_FILL_MS = 2000;

/**
 * `loadedAt` is a client-set timestamp (ms since epoch) captured when the
 * form mounted. Missing or malformed values fail open — this is a
 * defense-in-depth signal, not the primary gate, so a client that doesn't
 * send it shouldn't be the reason a real submission gets blocked.
 */
export function isSubmittedTooFast(loadedAt: unknown): boolean {
  const t = typeof loadedAt === "string" ? parseInt(loadedAt, 10) : typeof loadedAt === "number" ? loadedAt : NaN;
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < MIN_FORM_FILL_MS;
}
