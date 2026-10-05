"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OnboardingModal } from "./OnboardingModal";

// Pages where we never show the gate (auth loops, admin, already in onboarding)
const SKIP_PREFIXES = ["/auth", "/onboarding", "/admin"];
const SKIP_EXACT = new Set<string>();

// Default role suggestion by pathname
function suggestedRoleForPath(pathname: string): string {
  if (pathname.startsWith("/artists")) return "patron";
  if (pathname.startsWith("/partner")) return "partner";
  return "artist";
}

// sessionStorage key — marks this session as onboarding-complete
const DONE_KEY = "patronage_onboarding_done";

function GateInner() {
  const pathname = usePathname();
  const [modal, setModal] = useState<{
    existingRole: string | null;
    suggestedRole: string;
  } | null>(null);

  const skip =
    SKIP_EXACT.has(pathname) ||
    SKIP_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (skip) return;

    // Already confirmed complete this session
    try {
      if (sessionStorage.getItem(DONE_KEY) === "1") return;
    } catch {}

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, disciplines, full_name, country, city_id, org_category")
        .eq("id", user.id)
        .maybeSingle();

      const suggested = suggestedRoleForPath(pathname);

      if (!profile || !profile.role) {
        setModal({ existingRole: null, suggestedRole: suggested });
        return;
      }

      const isArtist = profile.role === "artist" || profile.role === "owner";
      const hasLocation = !!(profile.city_id || profile.country);

      const needsProfile =
        (isArtist && (!profile.disciplines?.length || !profile.full_name?.trim() || !hasLocation)) ||
        (profile.role === "patron" && !hasLocation) ||
        (profile.role === "partner" && (!hasLocation || !profile.org_category));

      if (needsProfile) {
        setModal({ existingRole: profile.role, suggestedRole: profile.role });
      } else {
        try { sessionStorage.setItem(DONE_KEY, "1"); } catch {}
      }
    });
  }, [skip, pathname]);

  if (!modal) return null;

  return (
    <OnboardingModal
      existingRole={modal.existingRole}
      suggestedRole={modal.suggestedRole}
      onComplete={() => {
        try { sessionStorage.setItem(DONE_KEY, "1"); } catch {}
        setModal(null);
      }}
    />
  );
}

export function OnboardingGate() {
  return (
    <Suspense fallback={null}>
      <GateInner />
    </Suspense>
  );
}
