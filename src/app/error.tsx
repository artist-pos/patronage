"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Segment error boundary — Header/Footer (in the root layout) stay mounted,
// only the page content is replaced. Without this, any uncaught client
// exception left the visitor on a dead "Application error" screen with no
// way back in — confirmed happening mid-onboarding via a PostHog session
// replay. capture_exceptions in PostHogProvider only catches errors that
// reach window.onerror; an error a boundary swallows needs reporting here.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="text-xl font-semibold">This page hit a snag.</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Nothing you entered was lost — try again, or head back to the homepage.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          onClick={reset}
          className="bg-black px-4 py-2 text-sm text-white transition-opacity hover:opacity-80"
        >
          Try again
        </button>
        <a
          href="/"
          className="border border-black px-4 py-2 text-sm transition-colors hover:bg-muted"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
