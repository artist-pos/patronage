"use client";

import type { PipelineReport } from "@/lib/admin";

const STATUS_LABELS: Record<string, string> = {
  pending: "New",
  shortlisted: "Shortlisted",
  selected: "Selected",
  approved_pending_assets: "Awaiting File",
  production_ready: "Download Ready",
  rejected: "Rejected",
};

export function PipelineExportButton({ report }: { report: PipelineReport }) {
  function exportCSV() {
    const { rows, allCustomQuestionLabels, customAnswersByAppId, questionLabelsByOppId } = report;

    const headers = [
      "Opportunity Title",
      "Opportunity Partner",
      "Opportunity Type",
      "Opportunity Deadline",
      "Funding Amount",
      "Applicant Name",
      "Applicant Email",
      "Applicant Username",
      "Applicant City",
      "Applicant Country",
      "Applicant Career Stage",
      "Applicant Age Bracket",
      "Applicant Identity Tags",
      "Applicant Disciplines",
      "Application Date",
      "Application Status",
      "Profile URL",
      "CV URL",
      "Submitted Image URL",
      ...allCustomQuestionLabels,
    ];

    const csvRows = rows.map((row) => {
      const answers = customAnswersByAppId[row.application_id] ?? {};
      const questionLabels = questionLabelsByOppId[row.opportunity_id] ?? {};

      // Build a label→answer map for this application
      const labelToAnswer: Record<string, string> = {};
      for (const [qId, answer] of Object.entries(answers)) {
        const label = questionLabels[qId];
        if (label) labelToAnswer[label] = answer;
      }

      return [
        row.opportunity_title,
        row.opportunity_organiser,
        row.opportunity_type,
        row.opportunity_deadline ?? "",
        row.funding_amount != null ? String(row.funding_amount) : "",
        row.artist_name,
        row.artist_email,
        row.artist_username,
        row.artist_city,
        row.artist_country,
        row.artist_career_stage,
        row.artist_age_bracket,
        row.artist_identity_tags,
        row.artist_disciplines,
        new Date(row.application_date).toLocaleDateString("en-NZ"),
        STATUS_LABELS[row.application_status] ?? row.application_status,
        row.artist_profile_url,
        row.artist_cv_url,
        row.submitted_image_url,
        ...allCustomQuestionLabels.map((label) => labelToAnswer[label] ?? ""),
      ];
    });

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csvContent = [headers, ...csvRows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `patronage-pipeline-all-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={exportCSV}
      className="text-xs border border-black px-4 py-2 hover:bg-muted transition-colors cursor-pointer"
    >
      Export all pipeline data ↓
    </button>
  );
}
