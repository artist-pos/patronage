/**
 * Display preferences for the opportunity-listing screens.
 *
 * The default is the compact view (the smaller type and lighter grey text those
 * screens had before the October accessibility pass). The accessibility view is
 * the current, larger-text, higher-contrast version with 44px touch targets.
 * Scoped CSS in globals.css (`.listing-ui`) does the switching; nothing here
 * touches the rest of the site.
 */
export interface UiPrefs {
  /** The accessibility view: larger type, darker secondary text, 44px targets. */
  a11y: boolean;
  /** A further 15% text step, on top of the accessibility view. */
  largeText: boolean;
  /** No animation or transitions. */
  reduceMotion: boolean;
}

export const DEFAULT_UI_PREFS: UiPrefs = { a11y: false, largeText: false, reduceMotion: false };

export const UI_PREFS_COOKIE = "patronage_ui";
export const UI_PREFS_MAX_AGE = 60 * 60 * 24 * 365;

/** Tolerant of anything: a hand-edited cookie must never break the page. */
export function parseUiPrefs(raw: unknown): UiPrefs | null {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return {
    a11y: v.a11y === true,
    largeText: v.largeText === true,
    reduceMotion: v.reduceMotion === true,
  };
}

export function serialiseUiPrefs(prefs: UiPrefs): string {
  return encodeURIComponent(JSON.stringify(prefs));
}
