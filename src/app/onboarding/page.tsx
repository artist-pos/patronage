import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PortfolioUploader } from "@/components/profile/PortfolioUploader";
import { redirect } from "next/navigation";

export const metadata = { title: "Edit Profile — Patronage" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
      <div className="space-y-1 border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile ? "Edit profile" : "Set up your profile"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile
            ? "Update your public artist profile."
            : "Complete your profile to appear in the artist directory."}
        </p>
      </div>

      <section className="space-y-6">
        <h2 className="text-base font-semibold">Profile details</h2>
        <ProfileForm profile={profile} />
      </section>

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Portfolio</h2>
            <p className="text-xs text-muted-foreground">
              Upload up to 10 images. JPEG or PNG, max 10 MB each. Images are
              resized to 1200px before uploading.
            </p>
          </div>
          <PortfolioUploader profileId={user.id} />
        </section>
      )}

      {profile && (
        <section className="space-y-6 border-t border-border pt-12">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">CV</h2>
            <p className="text-xs text-muted-foreground">
              Upload a PDF of your CV. It will be publicly linked from your profile.
            </p>
          </div>
          <PortfolioUploader profileId={user.id} mode="cv" />
        </section>
      )}
    </div>
  );
}
