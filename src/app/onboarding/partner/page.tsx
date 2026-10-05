import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { getCitiesWithRegions, getLocalBoards } from "@/lib/regions";
import { PartnerStepForm } from "./PartnerStepForm";
import type { OrgCategory } from "@/lib/org-categories";
import type { Profile } from "@/types/database";

export const metadata = { title: "Set Up Your Profile" };

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function OnboardingPartnerPage({ searchParams }: Props) {
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
  if (profile.role !== "partner") redirect("/studio");

  const seeded = profile as Profile & {
    city_id?: string | null;
    region_id?: string | null;
    local_board_id?: string | null;
  };
  const hasLocation = !!(seeded.city_id || profile.country);
  const hasOrgCategory = !!profile.org_category;
  if (hasLocation && hasOrgCategory) redirect(resume ?? "/partner/dashboard");

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
            Step 2 of 2
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tell us about your organisation
          </h1>
          <p className="text-sm text-muted-foreground">
            What you do and where you&rsquo;re based, so artists can find the right opportunities.
          </p>
        </div>

        <PartnerStepForm
          cities={cities}
          boards={boards}
          defaultLocalBoardId={seeded.local_board_id ?? null}
          defaultCountry={profile.country ?? ""}
          defaultCity={profile.city ?? ""}
          defaultCityId={seeded.city_id ?? null}
          defaultRegionId={seeded.region_id ?? null}
          defaultOrgCategory={(profile.org_category as OrgCategory | null) ?? null}
          next={resume}
        />
      </div>
    </div>
  );
}
