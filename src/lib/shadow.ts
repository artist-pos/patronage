/**
 * Shadow profiles created by an admin (claim tokens) are owned by a placeholder
 * login on an unroutable domain. Claiming one replaces the placeholder address
 * with the claimant's own, so the same account, profile and any content admin
 * prefilled all carry across with nothing to merge.
 */
export const SHADOW_EMAIL_DOMAIN = "shadow.invalid";

export function isShadowEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${SHADOW_EMAIL_DOMAIN}`);
}
