import type { PipelineQuestion } from "@/types/database";

function q(label: string, type: PipelineQuestion["type"], required = true): PipelineQuestion {
  return { id: crypto.randomUUID(), label, type, required };
}

export const PIPELINE_TEMPLATES: Record<string, PipelineQuestion[]> = {
  mural_commission: [
    q("Describe your mural or large-scale painting experience", "long_text"),
    q("Proposal for this mural — concept, imagery, and materials", "long_text"),
    q("How does your proposal respond to the site or community?", "long_text"),
    q("Budget breakdown (materials, scaffolding, labour)", "long_text"),
    q("Timeline and installation plan", "long_text"),
    q("Work samples — previous murals or large-scale works", "file_upload"),
  ],
  public_art_commission: [
    q("Describe your artistic practice and relevant public art experience", "long_text"),
    q("Proposal for this commission — concept, form, and materials", "long_text"),
    q("How does your proposal engage with the site and its community?", "long_text"),
    q("Technical specifications (dimensions, materials, structural requirements)", "long_text"),
    q("Budget breakdown", "long_text"),
    q("Timeline and installation plan", "long_text"),
    q("Work samples", "file_upload"),
  ],
  residency: [
    q("Describe your artistic practice", "long_text"),
    q("Proposed project or body of work for the residency", "long_text"),
    q("Timeline and milestones", "long_text"),
    q("Budget breakdown", "long_text"),
    q("Work samples (images, audio, or video)", "file_upload", false),
  ],
  open_call: [
    q("Describe your proposed work or contribution", "long_text"),
    q("Relevant experience or past work", "long_text"),
    q("Work samples", "file_upload"),
  ],
  job_employment: [
    q("Summarise your relevant experience and qualifications", "long_text"),
    q("Why are you interested in this role?", "long_text"),
    q("Describe a project or initiative you have led or contributed to", "long_text"),
    q("Upload your CV or resume", "file_upload"),
    q("Referees or references (optional)", "long_text", false),
  ],
  commission: [
    q("Describe your artistic practice and relevant experience", "long_text"),
    q("Proposal for this commission", "long_text"),
    q("Budget breakdown", "long_text"),
    q("Timeline", "long_text"),
    q("Work samples", "file_upload"),
  ],
  grant: [
    q("Describe your artistic practice", "long_text"),
    q("Project description and intended outcomes", "long_text"),
    q("How will this grant support your work?", "long_text"),
    q("Budget", "long_text"),
    q("Timeline", "long_text"),
  ],
  prize: [
    q("Describe the work you are entering", "long_text"),
    q("Work samples or documentation", "file_upload"),
    q("Artist statement", "long_text", false),
  ],
  display: [
    q("Describe the work you are proposing for display", "long_text"),
    q("Technical requirements or specifications", "long_text", false),
    q("Work samples or images", "file_upload"),
  ],
};

export type TemplateKey = keyof typeof PIPELINE_TEMPLATES;

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  mural_commission: "Mural Commission",
  public_art_commission: "Public Art Commission",
  residency: "Residency",
  open_call: "Exhibition Call / Open Call",
  job_employment: "Job / Employment",
  commission: "Commission",
  grant: "Grant",
  prize: "Prize",
  display: "Display",
};
