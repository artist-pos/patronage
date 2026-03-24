import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import type { Metadata } from "next";
import { PartnerEditForm } from "./PartnerEditForm";
import { CollaboratorsPanel } from "@/components/partner/CollaboratorsPanel";
import { getCollaborators } from "@/app/partner/opportunities/[id]/collaborators/actions";

export const metadata: Metadata = {
  title: "Edit Listing — Patronage",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PartnerEditPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: opp }, adminUser] = await Promise.all([
    supabase.from("opportunities").select("*").eq("id", id).single(),
    isAdmin(),
  ]);

  if (!opp) notFound();

  // Allow access if owner, admin, or collaborator
  const isOwner = opp.profile_id === user.id;
  if (!isOwner && !adminUser) {
    // Check collaborator access
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab) redirect("/partner/dashboard");
  }

  // Only owners and admins can manage collaborators
  const canManageCollaborators = isOwner || adminUser;

  // Fetch collaborators
  const { collaborators = [] } = await getCollaborators(id);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Edit Listing</h1>
        <p className="text-sm text-muted-foreground">
          {opp.status === "draft" || opp.status === "draft_unclaimed"
            ? "This listing is a draft — publish it when you're ready."
            : opp.status === "published"
            ? "This listing is live on Patronage."
            : `Status: ${opp.status}`}
        </p>
      </div>

      <PartnerEditForm opp={opp} />

      {/* Collaborators — owners and admins can manage; collaborators can view */}
      <CollaboratorsPanel
        opportunityId={id}
        initialCollaborators={collaborators}
        isOwner={canManageCollaborators}
      />
    </div>
  );
}
