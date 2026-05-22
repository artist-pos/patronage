import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import type { Metadata } from "next";
import { ManageShell } from "@/components/partner/ManageShell";
import { PartnerEditForm } from "@/app/partner/opportunities/[id]/edit/PartnerEditForm";
import { CollaboratorsPanel } from "@/components/partner/CollaboratorsPanel";
import { PartnerCommercePanel } from "@/components/partner/PartnerCommercePanel";
import { ManageFormSection } from "@/components/partner/ManageFormSection";
import { ManageRubricSection } from "@/components/partner/ManageRubricSection";
import { ManagePostSelectionSection } from "@/components/partner/ManagePostSelectionSection";
import { getCollaborators } from "@/app/partner/opportunities/[id]/collaborators/actions";
import { getRubricCriteria, getPartnerDocuments } from "@/app/partner/opportunities/[id]/new/actions";
import type { Opportunity, RubricCriterion, PartnerDocument } from "@/types/database";
import type { LocalCriterion } from "@/components/partner/wizard/RubricBuilder";

export const metadata: Metadata = { title: "Manage Listing — Patronage" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ManagePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: opp }, adminUser] = await Promise.all([
    supabase.from("opportunities").select("*").eq("id", id).single(),
    isAdmin(),
  ]);

  if (!opp) notFound();

  const isOwner = opp.profile_id === user.id;
  if (!isOwner && !adminUser) {
    const { data: collab } = await supabase
      .from("opportunity_collaborators")
      .select("role")
      .eq("opportunity_id", id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (!collab) redirect("/partner/dashboard");
  }

  const canManageCollaborators = isOwner || !!adminUser;
  const isPipeline = opp.routing_type === "pipeline";

  const [{ collaborators = [] }, criteria, documents] = await Promise.all([
    getCollaborators(id),
    isPipeline ? getRubricCriteria(id) : Promise.resolve([] as RubricCriterion[]),
    isPipeline ? getPartnerDocuments(id) : Promise.resolve([] as PartnerDocument[]),
  ]);

  const localCriteria: LocalCriterion[] = criteria.map((c) => ({
    id: c.id,
    label: c.label,
    helper: c.helper,
    weight: c.weight,
    scale_max: c.scale_max,
    position: c.position,
    locked: c.locked,
  }));

  return (
    <ManageShell opp={opp as Opportunity} isPipeline={isPipeline} opportunityId={id}>
      {/* Basics */}
      <section id="basics" className="scroll-mt-20 space-y-4">
        <SectionHeader label="Basics" desc="Core details — title, type, dates, description, image." />
        <PartnerEditForm opp={opp as Opportunity} />
      </section>

      {/* Application form (pipeline only) */}
      {isPipeline && (
        <section id="form" className="scroll-mt-20 space-y-4">
          <SectionHeader label="Application form" desc="Customise the questions artists answer when applying." />
          <ManageFormSection opp={opp as Opportunity} />
        </section>
      )}

      {/* Scoring rubric (pipeline only) */}
      {isPipeline && (
        <section id="rubric" className="scroll-mt-20 space-y-4">
          <SectionHeader label="Scoring rubric" desc="Define the criteria your review panel will score against." />
          <ManageRubricSection
            opportunityId={id}
            initialCriteria={localCriteria}
            initialDocuments={documents}
          />
        </section>
      )}

      {/* Post-selection (pipeline only) */}
      {isPipeline && (
        <section id="post-selection" className="scroll-mt-20 space-y-4">
          <SectionHeader
            label="Post-selection"
            desc="Configure programme requirements and notification behaviour."
          />
          <ManagePostSelectionSection opp={opp as Opportunity} />
        </section>
      )}

      {/* Commerce */}
      {isOwner && (
        <section id="commerce" className="scroll-mt-20 space-y-4">
          <SectionHeader label="Commerce" desc="Paid placement and pipeline billing." />
          <PartnerCommercePanel
            opportunityId={id}
            pipelinePaidAt={opp.pipeline_paid_at ?? null}
            featuredUntil={opp.featured_until ?? null}
          />
        </section>
      )}

      {/* Collaborators */}
      <section id="collaborators" className="scroll-mt-20 space-y-4">
        <SectionHeader label="Collaborators" desc="Invite reviewers and editors to this listing." />
        <CollaboratorsPanel
          opportunityId={id}
          initialCollaborators={collaborators}
          isOwner={canManageCollaborators}
        />
      </section>
    </ManageShell>
  );
}

function SectionHeader({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="space-y-0.5 pb-2 border-b border-black/10">
      <h2 className="text-base font-semibold">{label}</h2>
      <p className="text-sm text-stone-500">{desc}</p>
    </div>
  );
}
