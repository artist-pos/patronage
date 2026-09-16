"use client";

/**
 * Classic honeypot: real users never see or fill this, so any submission
 * with it non-empty is almost certainly scripted. Positioned off-screen
 * rather than `display:none` since some bots specifically skip hidden
 * inputs. Server actions check `formData.get(HONEYPOT_FIELD)` (or the
 * equivalent object field) and silently no-op when it's filled.
 */
export const HONEYPOT_FIELD = "hp_url";

export function HoneypotField() {
  return (
    <input
      type="text"
      name={HONEYPOT_FIELD}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
    />
  );
}
