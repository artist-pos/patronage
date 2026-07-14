"use client";

import { useFormStatus } from "react-dom";

interface Props {
  children: React.ReactNode;
  className?: string;
}

// Submit button that disables itself while its form's server action runs.
// Auth tokens are single-use — a double-click fires two POSTs where the first
// consumes the token and the second lands the user on "Link expired".
export function PendingButton({ children, className }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Please wait…" : children}
    </button>
  );
}
