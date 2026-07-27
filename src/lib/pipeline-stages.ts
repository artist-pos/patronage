// Shared stage definitions for the partner pipeline board (Kanban/Table/Triage views).
// The 6 underlying status VALUES are fixed — email/achievement/asset-handoff logic in
// src/app/partner/dashboard/actions.ts branches on these exact strings across ~20 files.
// What's customisable per-opportunity is which of the 6 are shown, in what order, and
// what they're labelled — stored in opportunities.pipeline_config.pipeline_stages.

export type StageValue =
  | "pending"
  | "shortlisted"
  | "selected"
  | "approved_pending_assets"
  | "production_ready"
  | "rejected";

export interface StageDef {
  val: StageValue;
  label: string;
  textColor: string;  // TriageView quick-action text colour
  badgeColor: string; // TableView status pill (bg + text)
  dot: string;         // OpportunityShell filter-chip dot
  /** True when this stage isn't in the opportunity's enabled list but still has
   *  applicants sitting in it (see getStagesWithOccupied). Render greyed-out. */
  disabled?: boolean;
}

export interface PipelineStagesConfig {
  enabled: string[];
  labels?: Record<string, string>;
}

const SYSTEM_STAGES: StageDef[] = [
  { val: "pending", label: "New", textColor: "text-stone-500", badgeColor: "bg-stone-100 text-stone-600", dot: "bg-amber-400" },
  { val: "shortlisted", label: "Shortlisted", textColor: "text-blue-600", badgeColor: "bg-blue-50 text-blue-700", dot: "bg-stone-700" },
  { val: "selected", label: "Selected", textColor: "text-green-600", badgeColor: "bg-green-50 text-green-700", dot: "bg-emerald-500" },
  { val: "approved_pending_assets", label: "Awaiting File", textColor: "text-yellow-600", badgeColor: "bg-yellow-50 text-yellow-700", dot: "bg-blue-400" },
  { val: "production_ready", label: "Ready", textColor: "text-emerald-600", badgeColor: "bg-emerald-50 text-emerald-700", dot: "bg-violet-500" },
  { val: "rejected", label: "Rejected", textColor: "text-red-500", badgeColor: "bg-red-50 text-red-700", dot: "bg-stone-300" },
];

export const ALL_STAGE_VALUES: StageValue[] = SYSTEM_STAGES.map((s) => s.val);

function withLabel(def: StageDef, labels?: Record<string, string>): StageDef {
  const custom = labels?.[def.val];
  return custom ? { ...def, label: custom } : def;
}

/** Ordered, enabled + labelled stage list. Falls back to all 6 system stages when unconfigured. */
export function getStages(config: PipelineStagesConfig | null | undefined): StageDef[] {
  const enabled = config?.enabled?.length ? config.enabled : ALL_STAGE_VALUES;
  return enabled
    .map((val) => SYSTEM_STAGES.find((s) => s.val === val))
    .filter((s): s is StageDef => !!s)
    .map((s) => withLabel(s, config?.labels));
}

/**
 * Same as getStages, but appends (at the end, flagged disabled) any system stage
 * that isn't enabled but still has applicants sitting in it — so a partner turning
 * a stage off never orphans applicants off the board.
 */
export function getStagesWithOccupied(
  config: PipelineStagesConfig | null | undefined,
  apps: { status: string }[]
): StageDef[] {
  const enabledStages = getStages(config).map((s) => ({ ...s, disabled: false }));
  const enabledVals = new Set(enabledStages.map((s) => s.val));
  const occupied = new Set(apps.map((a) => a.status));
  const extra = SYSTEM_STAGES
    .filter((s) => occupied.has(s.val) && !enabledVals.has(s.val))
    .map((s) => ({ ...withLabel(s, config?.labels), disabled: true }));
  return [...enabledStages, ...extra];
}

/** Label lookup for a single status value, honouring per-opportunity overrides. */
export function stageLabel(val: string, config: PipelineStagesConfig | null | undefined): string {
  const found = SYSTEM_STAGES.find((s) => s.val === val);
  if (!found) return val;
  return config?.labels?.[val] ?? found.label;
}
