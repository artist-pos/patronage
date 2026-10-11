import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { FolioCreatorClient } from "./FolioCreatorClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add a folio — Studio" };

export default async function NewFolioPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || (profile.role !== "artist" && profile.role !== "owner")) redirect("/studio");

  return <FolioCreatorClient profileId={user.id} />;
}
