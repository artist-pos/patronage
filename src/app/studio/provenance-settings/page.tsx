import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProvenanceSettingsForm } from "./ProvenanceSettingsForm";
import { StudioPageShell } from "../StudioPageShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provenance Settings — Studio — Patronage",
};

export default async function ProvenanceSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, username, provenance_logo_url, provenance_signature_url, provenance_template_theme, provenance_primary_color, provenance_accent_color, provenance_font_pair, provenance_orientation")
    .eq("id", user.id)
    .maybeSingle();

  const isArtist = profile?.role === "artist" || profile?.role === "owner";
  if (!isArtist) redirect("/studio");

  const signaturePath = profile?.provenance_signature_url ?? null;

  // Signature lives in a private bucket — generate a 1-hour signed URL for the
  // initial preview. The path is stored (not a public URL) so we check for "http".
  let signatureSignedUrl: string | null = null;
  if (signaturePath && !signaturePath.startsWith("http")) {
    const { data } = await admin.storage
      .from("provenance-signatures")
      .createSignedUrl(signaturePath, 3600);
    signatureSignedUrl = data?.signedUrl ?? null;
  } else if (signaturePath?.startsWith("http")) {
    // Legacy: old entries stored the public URL directly — keep it as-is
    signatureSignedUrl = signaturePath;
  }

  return (
    <StudioPageShell username={profile?.username ?? ""} activeSection="provenance">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Certificate settings</h2>
          <p className="text-sm text-muted-foreground">
            Customise how your certificates look. These settings apply to all future certificates.
          </p>
        </div>

        <ProvenanceSettingsForm
          userId={user.id}
          initialLogoUrl={profile?.provenance_logo_url ?? null}
          initialSignaturePath={signaturePath}
          initialSignatureSignedUrl={signatureSignedUrl}
          initialTheme={(profile?.provenance_template_theme as "minimal" | "editorial" | "gallery") ?? "minimal"}
          initialPrimaryColor={profile?.provenance_primary_color ?? "#000000"}
          initialAccentColor={profile?.provenance_accent_color ?? "#888888"}
          initialFontPair={(profile?.provenance_font_pair as "classic") ?? "classic"}
          initialOrientation={(profile?.provenance_orientation as "portrait" | "landscape") ?? "portrait"}
        />
      </div>
    </StudioPageShell>
  );
}
