/**
 * Token-aware rate limiter for the Anthropic API.
 *
 * Haiku's limit is 50,000 input tokens/minute. We target 40,000 to stay
 * comfortably below it. Before each API call we estimate the token count,
 * check the sliding 60-second window, and wait if needed. On 429 responses
 * we retry with exponential backoff.
 */

const TOKEN_BUDGET = 40_000; // conservative — true limit is 50k input tokens/min
const WINDOW_MS = 60_000;
const MAX_RETRIES = 3;

interface TokenEntry {
  tokens: number;
  at: number;
}

class RateLimiter {
  private window: TokenEntry[] = [];

  private usedInWindow(now: number): number {
    this.window = this.window.filter((e) => now - e.at < WINDOW_MS);
    return this.window.reduce((sum, e) => sum + e.tokens, 0);
  }

  /** Blocks until there is enough token capacity, then reserves `estimatedTokens`. */
  async waitForCapacity(estimatedTokens: number): Promise<void> {
    while (true) {
      const now = Date.now();
      const used = this.usedInWindow(now);

      if (used + estimatedTokens <= TOKEN_BUDGET) {
        this.window.push({ tokens: estimatedTokens, at: now });
        return;
      }

      // Wait until the oldest entry expires so we regain its tokens
      const oldest = this.window[0];
      const waitMs = WINDOW_MS - (Date.now() - oldest.at) + 250; // +250ms buffer
      console.log(
        `  ⏳ Token budget at ${used}/${TOKEN_BUDGET}/min — waiting ${Math.round(waitMs / 1000)}s`
      );
      await sleep(Math.max(waitMs, 1_000));
    }
  }
}

export const rateLimiter = new RateLimiter();

/** Rough token estimate: 1 token ≈ 4 chars, plus ~700 for the system prompt. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4) + 700;
}

/**
 * Wraps an Anthropic API call with:
 *   1. Token-budget gating (waits before calling if budget is low)
 *   2. Exponential backoff on 429 responses
 */
export async function withRateLimit<T>(
  fn: () => Promise<T>,
  estimatedTokens: number
): Promise<T> {
  await rateLimiter.waitForCapacity(estimatedTokens);

  let delay = 1_000;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        console.warn(
          `  ↻ 429 received — retrying in ${delay / 1_000}s ` +
            `(attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(delay);
        delay = Math.min(delay * 2, 30_000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded after repeated 429 errors");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
