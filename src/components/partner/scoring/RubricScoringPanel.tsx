"use client";

import { useState, useEffect } from "react";
import { getCriteriaForOpportunity, getScoresForApplication, upsertScore } from "@/app/partner/dashboard/scoring/actions";
import type { RubricCriterion, ApplicationScore } from "@/types/database";

interface Props {
  opportunityId: string;
  applicationId: string;
}

export function RubricScoringPanel({ opportunityId, applicationId }: Props) {
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [scores, setScores] = useState<ApplicationScore[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getCriteriaForOpportunity(opportunityId),
      getScoresForApplication(applicationId),
    ]).then(([c, s]) => {
      setCriteria(c);
      setScores(s);
      setLoaded(true);
    });
  }, [opportunityId, applicationId]);

  if (!loaded) return <p className="text-xs text-stone-400">Loading rubric…</p>;
  if (criteria.length === 0) return null;

  function myScore(criterionId: string) {
    return scores.find((s) => s.criterion_id === criterionId)?.score ?? null;
  }

  async function handleScore(criterionId: string, score: number) {
    setSaving(criterionId);
    const prev = scores.find((s) => s.criterion_id === criterionId);
    // Optimistic update
    setScores((prev) =>
      prev.some((s) => s.criterion_id === criterionId)
        ? prev.map((s) => (s.criterion_id === criterionId ? { ...s, score } : s))
        : [...prev, { id: "tmp", application_id: applicationId, criterion_id: criterionId, reviewer_id: "", score, note: null, updated_at: "" } as ApplicationScore]
    );
    await upsertScore(opportunityId, applicationId, criterionId, score);
    setSaving(null);
    // Refresh scores for updated_at etc.
    getScoresForApplication(applicationId).then(setScores);
    void prev;
  }

  // Weighted average
  const scored = criteria.filter((c) => myScore(c.id) !== null);
  const weightedSum = scored.reduce((sum, c) => sum + (myScore(c.id)! / c.scale_max) * c.weight, 0);
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0);
  const avg = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest">Scoring</p>
        {avg !== null && (
          <span className="text-xs font-medium">
            {avg.toFixed(0)}% overall
          </span>
        )}
      </div>

      <div className="space-y-4">
        {criteria.map((c) => {
          const current = myScore(c.id);
          const isSaving = saving === c.id;
          const steps = Array.from({ length: c.scale_max }, (_, i) => i + 1);
          return (
            <div key={c.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  {c.helper && <p className="text-xs text-stone-400">{c.helper}</p>}
                </div>
                <span className="text-[10px] text-stone-400 shrink-0 mt-0.5">×{c.weight}</span>
              </div>
              <div className="flex gap-1">
                {steps.map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleScore(c.id, n)}
                    className={`w-8 h-8 text-xs font-medium border transition-colors ${
                      current === n
                        ? "border-black bg-black text-white"
                        : "border-stone-200 hover:border-black"
                    } disabled:opacity-50`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {scored.length < criteria.length && (
        <p className="text-[11px] text-stone-400">
          {criteria.length - scored.length} criterion{criteria.length - scored.length !== 1 ? "a" : ""} not yet scored.
        </p>
      )}
    </div>
  );
}
