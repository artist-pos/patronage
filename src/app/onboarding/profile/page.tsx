import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getCitiesWithRegions } from "@/lib/regions";
import { ProfileStepForm } from "./ProfileStepForm";
import type { DisciplineEnum, Profile } from "@/types/database";

export const metadata = { title: "Set Up Your Profile — Patronage" };

/**
 * The one screen between signing up and seeing something worth staying for.
 *
 * Four fields, not the thirteen on /studio: a name, a country, a city, and
 * the disciplines the matching filter runs on. Everything else about a profile
 * can be filled in later, from a page they now have a reason to return to.
 *
 * Artists only. A patron or partner has no disciplines to match on and goes
 * straight to their dashboard from the role step.
 */
export default async function OnboardingProfilePage() {
  const { user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [profile, cities] = await Promise.all([
    getProfileById(user.id),
    getCitiesWithRegions(),
  ]);

  if (!profile?.role) redirect("/onboarding/role");
  const isArtist = profile.role === "artist" || profile.role === "owner";
  if (!isArtist) redirect("/dashboard");

  // Already answered — this step is not a place to come back to.
  if (profile.disciplines?.length && profile.full_name?.trim()) {
    redirect("/opportunities?tab=for-you");
  }

  const seeded = profile as Profile & { city_id?: string | null; region_id?: string | null };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Step 2 of 2
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tell us what you make
          </h1>
          <p className="text-sm text-muted-foreground">
            Four answers, and we&rsquo;ll show you what&rsquo;s open right now.
          </p>
        </div>

        <ProfileStepForm
          cities={cities}
          defaultName={profile.full_name ?? ""}
          defaultCountry={profile.country ?? ""}
          defaultCity={profile.city ?? ""}
          defaultCityId={seeded.city_id ?? null}
          defaultRegionId={seeded.region_id ?? null}
          defaultDisciplines={(profile.disciplines ?? []) as DisciplineEnum[]}
        />
      </div>
    </div>
  );
}
