import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { DigestToggle } from "@/components/profile/DigestToggle";
import { TerminateAccountButton } from "@/components/profile/TerminateAccountButton";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Account — Studio" };

export default async function StudioAccountPage() {
  const { user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const fullProfile = await getProfileById(user.id);
  if (!fullProfile) redirect("/auth/login");

  return (
    <div className="space-y-12 max-w-2xl">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Email Preferences</h2>
          <p className="text-xs text-muted-foreground">
            You are subscribed to the weekly email by default. Toggle off to unsubscribe.
          </p>
        </div>
        <DigestToggle
          initial={fullProfile.weekly_digest ?? true}
          autoSync={fullProfile.weekly_digest === null}
        />
      </section>

      <section className="space-y-4 border-t border-black pt-10">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
          <p className="text-xs text-muted-foreground">
            Closing your account is permanent. Your profile, portfolio images, and all data will be deleted immediately and cannot be recovered.
          </p>
        </div>
        <TerminateAccountButton />
      </section>
    </div>
  );
}
