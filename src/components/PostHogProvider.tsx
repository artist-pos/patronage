"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

const PRIVATE_PREFIXES = ["/admin", "/studio", "/dashboard", "/partner"];

if (typeof window !== "undefined") {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false,  // manual — handles App Router SPA navigation
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname || PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) return;
    const qs = searchParams.toString();
    ph.capture("$pageview", {
      $current_url: window.origin + pathname + (qs ? `?${qs}` : ""),
    });
  }, [pathname, searchParams, ph]);

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
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
