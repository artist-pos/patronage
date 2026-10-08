import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { loadPipelineApplications } from "@/lib/pipeline-applications";
import { readReviewConfig } from "@/lib/review-scoring";
import { APPLICATION_BIO_KEY } from "@/lib/application-bio";
import { ReviewQueue } from "@/components/review/ReviewQueue";
import { ReviewerSignIn } from "@/components/review/ReviewerSignIn";
import { AccountPrompt } from "@/components/review/AccountPrompt";
import type { ReviewApp, ReviewAnswer, ReviewWork, ReviewCriterionDTO } from "@/components/review/types";
import type { CustomField, PipelineConfig } from "@/types/database";

export const metadata: Metadata = { title: "Review", robots: { index: false } };

interface Props {
  params: Promise<{ opportunityId: string }>;
}

export default async function ReviewPage({ params }: Props) {
  const { opportunityId } = await params;
  const admin = createAdminClient();

  const { data: opp } = await admin
    .from("opportunities")
    .select("id, title, organiser, profile_id, pipeline_config, custom_fields")
    .eq("id", opportunityId)
    .maybeSingle();
  if (!opp) notFound();

  const { user } = await getServerUser();
  if (!user) return <ReviewerSignIn opportunityId={opportunityId} title={opp.title as string} />;

  // Who is this, and what may they do here?
  const [{ data: profile }, { data: collab }] = await Promise.all([
    admin.from("profiles").select("role, full_name").eq("id", user.id).single(),
    admin.from("opportunity_collaborators").select("role").eq("opportunity_id", opportunityId).eq("profile_id", user.id).maybeSingle(),
  ]);
  const isAdmin = profile?.role === "admin" || profile?.role === "owner";
  const isOwner = isAdmin || opp.profile_id === user.id;
  if (!isOwner && !collab) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 space-y-2 text-center">
        <h1 className="text-xl font-semibold">You&apos;re not on this review team</h1>
        <p className="text-sm text-stone-500">Ask the organiser to invite the email address you signed in with.</p>
      </div>
    );
  }
  const canScore = isOwner || collab?.role === "editor";

  const pipelineConfig = (opp.pipeline_config ?? null) as PipelineConfig | null;
  const config = readReviewConfig(pipelineConfig);

  // In "split" and "manual" mode a reviewer only sees what is assigned to them.
  let appIds: string[] | null = null;
  if (!isOwner && config.assignment_mode !== "all") {
    const { data: rows } = await admin
      .from("application_assignments")
      .select("application_id")
      .eq("opportunity_id", opportunityId)
      .eq("reviewer_id", user.id);
    appIds = (rows ?? []).map((r) => r.application_id as string);
  }

  const customFields = (opp.custom_fields ?? []) as CustomField[];
  const [loaded, { data: criteriaRows }, { data: recusalRows }] = await Promise.all([
    loadPipelineApplications(admin, opportunityId, { pipeline_config: pipelineConfig, custom_fields: customFields }, { appIds, newestFirst: false }),
    admin.from("rubric_criteria").select("id, label, helper, weight, scale_max").eq("opportunity_id", opportunityId).order("position"),
    admin.from("application_recusals").select("application_id").eq("opportunity_id", opportunityId).eq("reviewer_id", user.id),
  ]);
  // Applications this reviewer has stepped back from never reappear in their queue.
  const stepped = new Set((recusalRows ?? []).map((r) => r.application_id as string));
  const applications = loaded.filter((a) => !stepped.has(a.id));

  const criteria: ReviewCriterionDTO[] = (criteriaRows ?? []).map((c) => ({
    id: c.id as string,
    label: c.label as string,
    helper: (c.helper as string | null) ?? null,
    weight: c.weight as number,
    scaleMax: c.scale_max as number,
  }));

  const ids = applications.map((a) => a.id);
  const { data: scoreRows } = ids.length
    ? await admin.from("application_scores").select("application_id, criterion_id, score").eq("reviewer_id", user.id).in("application_id", ids)
    : { data: [] };
  const initialScores: Record<string, Record<string, number>> = {};
  for (const r of scoreRows ?? []) {
    (initialScores[r.application_id as string] ??= {})[r.criterion_id as string] = r.score as number;
  }

  const questions = pipelineConfig?.questions?.length
    ? pipelineConfig.questions.map((q) => ({ id: q.id, label: q.label, isFile: q.type === "file_upload" }))
    : customFields.map((f) => ({ id: f.id, label: f.question, isFile: f.inputType === "file" }));

  const reviewApps: ReviewApp[] = applications.map((a) => {
    const artist = a.artist;
    const works: ReviewWork[] = [];
    if (a.artwork) {
      works.push({ id: a.artwork.id, url: a.artwork.url, title: a.artwork.caption, description: a.work_descriptions[a.artwork.id] || a.artwork.description });
    }
    for (const w of a.creative_works ?? []) {
      works.push({ id: w.id, url: w.thumb_url ?? w.url, title: w.title ?? w.caption, description: a.work_descriptions[w.id] || w.description });
    }
    if (works.length === 0 && a.submitted_image_url) {
      works.push({ id: "legacy", url: a.submitted_image_url, title: null, description: null });
    }

    const answers: ReviewAnswer[] = [];
    // Blind review: nothing that says who they are.
    const code = a.id.slice(-4).toUpperCase();
    for (const q of questions) {
      const raw = a.custom_answers?.[q.id];
      if (!raw) continue;
      if (q.isFile) {
        let files: string[] = [];
        try { const parsed = JSON.parse(raw); files = Array.isArray(parsed) ? parsed : [raw]; } catch { files = [raw]; }
        answers.push({ label: q.label, text: null, files });
      } else {
        answers.push({ label: q.label, text: raw, files: [] });
      }
    }

    const custom = a.custom_answers ?? {};
    return {
      id: a.id,
      name: config.blind ? `Applicant ${code}` : artist?.full_name ?? artist?.username ?? "Applicant",
      username: config.blind ? null : artist?.username ?? null,
      location: config.blind ? null : [artist?.city, artist?.country].filter(Boolean).join(", ") || null,
      careerStage: artist?.career_stage ?? null,
      medium: artist?.medium ?? [],
      statement: custom[APPLICATION_BIO_KEY]?.trim() || (questions.length === 0 ? artist?.bio ?? null : null),
      cvUrl: config.blind ? null : artist?.cv_url ?? null,
      works,
      answers,
    };
  });

  return (
    <div>
      {profile?.role === "reviewer" && (
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 pt-4">
          <AccountPrompt
            opportunityId={opportunityId}
            organiser={(opp.organiser as string) || "this organisation"}
            initialName={(profile.full_name as string | null) ?? null}
          />
        </div>
      )}
      <ReviewQueue
        opportunityId={opportunityId}
        title={opp.title as string}
        apps={reviewApps}
        criteria={criteria}
        initialScores={initialScores}
        canScore={canScore}
        blind={config.blind}
        backHref={isOwner ? `/partner/dashboard/${opportunityId}` : "/review"}
      />
    </div>
  );
}
