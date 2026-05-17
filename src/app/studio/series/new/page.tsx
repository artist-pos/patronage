import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { StudioPageShell } from "@/app/studio/StudioPageShell";
import { SeriesCreatorClient } from "./SeriesCreatorClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create Series — Studio — Patronage" };

export default async function NewSeriesPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, username")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) {
    redirect("/studio");
  }

  return (
    <StudioPageShell username={profile.username ?? ""} activeSection="works">
      <SeriesCreatorClient profileId={user.id} />
    </StudioPageShell>
  );
}
