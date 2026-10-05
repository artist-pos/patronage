import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getCitiesWithRegions, getLocalBoards } from "@/lib/regions";
import { PatronStepForm } from "./PatronStepForm";
import type { Profile } from "@/types/database";

export const metadata = { title: "Set Up Your Profile" };

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function OnboardingPatronPage({ searchParams }: Props) {
  const { next } = await searchParams;
  const resume =
    next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding")
      ? next
      : null;

  const { user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const [profile, cities, boards] = await Promise.all([
    getProfileById(user.id),
    getCitiesWithRegions(),
    getLocalBoards(),
  ]);

  if (!profile?.role) redirect("/onboarding/role");
  if (profile.role !== "patron") redirect("/studio");

  const seeded = profile as Profile & {
    city_id?: string | null;
    region_id?: string | null;
    local_board_id?: string | null;
  };
  const hasLocation = !!(seeded.city_id || profile.country);
  if (hasLocation) redirect(resume ?? "/dashboard");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Step 2 of 2
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Where are you based?
          </h1>
          <p className="text-sm text-muted-foreground">
            Tell us where you&rsquo;re based and what you love — we&rsquo;ll show you who&rsquo;s making it nearby.
          </p>
        </div>

        <PatronStepForm
          cities={cities}
          boards={boards}
          defaultLocalBoardId={seeded.local_board_id ?? null}
          defaultCountry={profile.country ?? ""}
          defaultCity={profile.city ?? ""}
          defaultCityId={seeded.city_id ?? null}
          defaultRegionId={seeded.region_id ?? null}
          defaultMedium={profile.medium ?? []}
          next={resume}
        />
      </div>
    </div>
  );
}
