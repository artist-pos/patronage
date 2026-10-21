import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/rabobank/settings";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Rabobank pilot", robots: { index: false, follow: false } };

export default async function RabobankAdmin() {
  const admin = createAdminClient();
  const [settings, tokens, responses] = await Promise.all([
    getSettings(),
    admin.from("rabobank_access_token").select("*").order("created_at", { ascending: false }),
    admin.from("rabobank_survey_response").select("*").order("created_at", { ascending: false }),
  ]);
  return <Dashboard settings={settings} tokens={tokens.data ?? []} rows={responses.data ?? []} />;
}
