"use client";

interface Props {
  /** e.g. "Profile updated", "Work saved" */
  message: string;
  /** Show only when true; persists until the next edit clears it */
  visible: boolean;
}

/**
 * Inline save confirmation that persists until the next edit.
 * Place next to submit buttons — replaces the disappearing-toast pattern
 * so slow readers are never left wondering whether their save went through.
 */
export function SaveConfirmation({ message, visible }: Props) {
  if (!visible) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 text-xs text-emerald-700"
    >
      <svg
        className="w-3.5 h-3.5 shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </span>
  );
}
