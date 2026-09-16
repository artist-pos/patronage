"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Catches errors thrown by the root layout itself (Header, providers) — the
// one case app/error.tsx can't cover, since that boundary lives inside the
// layout it would need to replace. Renders its own <html>/<body> with inline
// styles only: this replaces the whole document, so it can't rely on
// globals.css having loaded.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#FAFAF9",
          color: "#000",
        }}
      >
        <p style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888" }}>
          Something went wrong
        </p>
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>Patronage hit a snag.</h1>
        <p style={{ maxWidth: "22rem", fontSize: "14px", color: "#888" }}>
          Try again, or head back to the homepage.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
          <button
            onClick={reset}
            style={{ background: "#000", color: "#fff", padding: "0.5rem 1rem", fontSize: "14px", border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
          <a
            href="/"
            style={{ border: "1px solid #000", padding: "0.5rem 1rem", fontSize: "14px", color: "#000", textDecoration: "none" }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
