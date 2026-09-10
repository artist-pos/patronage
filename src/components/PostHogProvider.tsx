"use client";

import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

// Routes whose URLs carry record ids or private context. We DO send pageviews
// for these — suppressing them entirely made the logged-in product invisible to
// retention and funnels, so every artist who came back looked churned — but the
// ids are replaced and the query string dropped before anything leaves the
// browser. Scrubbing happens in before_send so it also covers autocapture,
// rage clicks and pageleave, not just the manual pageview below.
const PRIVATE_PREFIXES = [
  "/admin",
  "/studio",
  "/dashboard",
  "/partner",
  "/messages",
  "/settings",
];

const ID_SEGMENT =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

const URL_PROPS = [
  "$current_url",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
];

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));
}

function sanitisePath(pathname: string) {
  return pathname
    .split("/")
    .map((seg) => (ID_SEGMENT.test(seg) ? ":id" : seg))
    .join("/");
}

/** Strip ids and query strings from private URLs. Public URLs pass through. */
function scrubUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (!isPrivatePath(parsed.pathname)) return null;
  return parsed.origin + sanitisePath(parsed.pathname);
}

function scrubEvent(cr: CaptureResult | null): CaptureResult | null {
  const props = cr?.properties;
  if (!props) return cr;

  for (const key of URL_PROPS) {
    const scrubbed = scrubUrl(props[key]);
    if (scrubbed) props[key] = scrubbed;
  }

  if (typeof props.$pathname === "string" && isPrivatePath(props.$pathname)) {
    props.$pathname = sanitisePath(props.$pathname);
    props.private_area = true;
  }

  return cr;
}

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,  // manual — handles App Router SPA navigation
    capture_pageleave: true,
    capture_exceptions: true, // surfaces the JS errors behind rage clicks
    before_send: scrubEvent,
    persistence: "localStorage+cookie",
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname) return;
    // Private routes get the pageview but not the query string; before_send
    // handles the path itself.
    const qs = isPrivatePath(pathname) ? "" : searchParams.toString();
    ph.capture("$pageview", {
      $current_url: window.origin + pathname + (qs ? `?${qs}` : ""),
      $pathname: pathname,
    });
  }, [pathname, searchParams, ph]);

  return null;
}

/**
 * Signup completion, captured explicitly.
 *
 * $identify can't stand in for this: it fires on any anonymous-to-identified
 * transition, so it counts logins too. /onboarding/role redirects here with
 * signup=1, and that action runs exactly once per account.
 */
function PostHogSignupCompleted() {
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (searchParams.get("signup") !== "1") return;
    try {
      if (sessionStorage.getItem("ph_signup_captured")) return;
      sessionStorage.setItem("ph_signup_captured", "1");
    } catch {
      // Private mode / blocked storage — capturing twice beats not at all.
    }
    ph.capture("signup_completed");
  }, [searchParams, ph]);

  return null;
}

function PostHogIdentify() {
  const ph = usePostHog();

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) ph.identify(user.id, { email: user.email });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        ph.identify(session.user.id, { email: session.user.email });
      } else if (event === "SIGNED_OUT") {
        ph.reset();
      }
    });

    return () => subscription.unsubscribe();
  }, [ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <Suspense fallback={null}>
        <PostHogSignupCompleted />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
