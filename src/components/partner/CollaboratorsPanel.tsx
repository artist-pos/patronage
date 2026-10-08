"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { OpportunityCollaborator } from "@/types/database";
import {
  getCollaborators,
  inviteCollaborator,
  removeCollaborator,
  resendCollaboratorInvite,
  updateCollaboratorRole,
} from "@/app/partner/opportunities/[id]/collaborators/actions";
import {
  getReviewOverview,
  remindReviewer,
  setBlindReview,
  setReviewAssignment,
  type ReviewOverview,
} from "@/app/partner/dashboard/review-actions";
import type { AssignmentMode } from "@/lib/review-scoring";

interface Props {
  opportunityId: string;
  initialCollaborators: OpportunityCollaborator[];
  isOwner: boolean;
}

const PERMISSIONS = [
  { label: "View applications",      owner: true, editor: true,  viewer: true  },
  { label: "Score and leave notes",  owner: true, editor: true,  viewer: false },
  { label: "Choose who is shortlisted or selected", owner: true, editor: true,  viewer: false },
  { label: "See applicant emails",   owner: true, editor: true,  viewer: false },
  { label: "Export data",            owner: true, editor: true,  viewer: false },
  { label: "Edit opportunity setup", owner: true, editor: false, viewer: false },
  { label: "Invite and assign",      owner: true, editor: false, viewer: false },
];

const MODES: Array<{ id: AssignmentMode; label: string; hint: string }> = [
  { id: "all", label: "Everyone reviews everything", hint: "Every reviewer scores every application. Best for small calls." },
  { id: "split", label: "Split evenly", hint: "Each application goes to a set number of reviewers, balanced so no one is overloaded." },
  { id: "manual", label: "I'll choose", hint: "You pick the reviewers for each application from its panel." },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function CollaboratorsPanel({ opportunityId, initialCollaborators, isOwner }: Props) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [overview, setOverview] = useState<ReviewOverview | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("editor");
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [mode, setMode] = useState<AssignmentMode>("all");
  const [perApp, setPerApp] = useState(2);
  const [blind, setBlind] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCollaborators(opportunityId), getReviewOverview(opportunityId)]).then(([list, ov]) => {
      if (cancelled) return;
      if (list.collaborators) setCollaborators(list.collaborators);
      if (ov) {
        setOverview(ov);
        setMode(ov.config.assignment_mode);
        setPerApp(ov.config.per_application);
        setBlind(ov.config.blind);
      }
    });
    return () => { cancelled = true; };
  }, [opportunityId, reloadKey]);

  function say(text: string, tone: "ok" | "error") {
    setMessage({ text, tone });
    setTimeout(() => setMessage(null), 6000);
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const sentTo = email.trim();
    startTransition(async () => {
      const result = await inviteCollaborator(opportunityId, sentTo, role);
      if (result.error) {
        say(result.error, "error");
        if (result.created !== undefined) refresh(); // added, but the email failed
        return;
      }
      say(
        result.created
          ? `Invited ${sentTo}. They do not need an account: the email has a button that takes them straight to the applications.`
          : `Invited ${sentTo}. They already have an account, so the link takes them to the review.`,
        "ok",
      );
      setEmail("");
      setShowInvite(false);
      refresh();
    });
  }

  function handleRemove(collaboratorId: string) {
    startTransition(async () => {
      const result = await removeCollaborator(opportunityId, collaboratorId);
      if (result.error) { say(result.error, "error"); return; }
      setConfirmRemove(null);
      refresh();
    });
  }

  function handleRoleChange(collaboratorId: string, newRole: "viewer" | "editor") {
    startTransition(async () => {
      const result = await updateCollaboratorRole(opportunityId, collaboratorId, newRole);
      if (result.error) { say(result.error, "error"); return; }
      setCollaborators((prev) => prev.map((c) => (c.id === collaboratorId ? { ...c, role: newRole } : c)));
      refresh();
    });
  }

  function handleResend(collaboratorId: string) {
    startTransition(async () => {
      const result = await resendCollaboratorInvite(opportunityId, collaboratorId);
      say(result.error ?? "A fresh sign-in link has been sent.", result.error ? "error" : "ok");
    });
  }

  function handleRemind(profileId: string) {
    startTransition(async () => {
      const result = await remindReviewer(opportunityId, profileId);
      say(result.error ?? "Reminder sent.", result.error ? "error" : "ok");
    });
  }

  function toggleBlind(next: boolean) {
    setBlind(next);
    startTransition(async () => {
      const result = await setBlindReview(opportunityId, next);
      if (result.error) { setBlind(!next); say(result.error, "error"); return; }
      say(next ? "Blind review is on. Reviewers can't see who applicants are." : "Blind review is off.", "ok");
    });
  }

  function applyAssignment() {
    startTransition(async () => {
      const result = await setReviewAssignment(opportunityId, mode, perApp);
      if (result.error) { say(result.error, "error"); return; }
      say(mode === "split" ? `Shared out ${result.assigned ?? 0} review places.` : "Saved.", "ok");
      refresh();
    });
  }

  const reviewerCount = collaborators.filter((c) => c.role === "editor").length;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Your review team</h2>
          <p className="text-base text-stone-600 leading-relaxed">
            Invite colleagues, board members or panel judges by email. <strong className="text-foreground font-semibold">They do not need an account</strong>: the email has a button that opens a simple page where they read and score applications. <strong className="text-foreground font-semibold">Reviewers</strong> can score and help decide; <strong className="text-foreground font-semibold">observers</strong> can only read.
          </p>
        </div>
        {isOwner && (
          <button type="button" onClick={() => setShowInvite((v) => !v)} aria-expanded={showInvite}
            className="shrink-0 bg-brand text-brand-foreground text-sm px-4 py-2 hover:bg-brand/90 transition-colors font-medium">
            + Invite someone
          </button>
        )}
      </div>

      {message && (
        <p role="status" className={`border px-3 py-2 text-sm ${message.tone === "error" ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
          {message.text}
        </p>
      )}

      {showInvite && isOwner && (
        <form onSubmit={handleInvite} className="border border-black/10 p-4 space-y-3 bg-stone-50/50">
          <label htmlFor="invite-email" className="text-sm font-medium">Email address</label>
          <div className="flex flex-wrap gap-2">
            <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@organisation.nz" required autoComplete="off"
              className="min-w-[14rem] flex-1 text-base border border-black/20 px-3 py-2 bg-white focus:outline-none focus:border-black" />
            <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
              className="text-sm border border-black/20 px-2 py-2 bg-white focus:outline-none focus:border-black">
              <option value="editor">Reviewer (can score)</option>
              <option value="viewer">Observer (read only)</option>
            </select>
            <button type="submit" disabled={isPending || !email.trim()}
              className="text-sm border border-brand px-4 py-2 hover:bg-brand hover:text-brand-foreground transition-colors disabled:opacity-50">
              {isPending ? "Inviting…" : "Send invite"}
            </button>
          </div>
        </form>
      )}

      {/* Team */}
      <div className="border border-black/10 divide-y divide-black/5">
        {collaborators.map((collab) => {
          const displayName = collab.profile?.full_name ?? collab.profile?.username ?? "Reviewer";
          const progress = overview?.progress[collab.profile_id];
          return (
            <div key={collab.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-stone-700 text-white flex items-center justify-center text-sm font-semibold shrink-0" aria-hidden>
                  {initials(displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  {collab.profile?.username && <p className="text-sm text-stone-500 truncate">@{collab.profile.username}</p>}
                </div>
                {isOwner ? (
                  <select aria-label={`Role for ${displayName}`} value={collab.role}
                    onChange={(e) => handleRoleChange(collab.id, e.target.value as "viewer" | "editor")} disabled={isPending}
                    className="text-sm border border-black/20 px-2 py-1.5 bg-transparent focus:outline-none focus:border-black cursor-pointer disabled:opacity-50">
                    <option value="editor">Reviewer (can score)</option>
                    <option value="viewer">Observer (read only)</option>
                  </select>
                ) : (
                  <span className="text-sm text-stone-600">{collab.role === "editor" ? "Reviewer" : "Observer"}</span>
                )}
              </div>

              {collab.role === "editor" && progress && (
                <div className="flex items-center gap-3 pl-12">
                  <div className="h-1.5 flex-1 bg-stone-100" role="progressbar" aria-valuemin={0} aria-valuemax={progress.assigned} aria-valuenow={progress.complete} aria-label={`${displayName} progress`}>
                    <div className="h-full bg-brand" style={{ width: `${progress.assigned ? (progress.complete / progress.assigned) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm tabular-nums text-stone-500 shrink-0">{progress.complete} of {progress.assigned} scored</span>
                </div>
              )}

              {isOwner && (
                <div className="flex flex-wrap items-center gap-3 pl-12 text-sm">
                  <button type="button" onClick={() => handleResend(collab.id)} disabled={isPending} className="underline underline-offset-2 text-stone-500 hover:text-foreground disabled:opacity-50">
                    Resend invite
                  </button>
                  {collab.role === "editor" && progress && progress.complete < progress.assigned && (
                    <button type="button" onClick={() => handleRemind(collab.profile_id)} disabled={isPending} className="underline underline-offset-2 text-stone-500 hover:text-foreground disabled:opacity-50">
                      Remind to finish
                    </button>
                  )}
                  {confirmRemove === collab.id ? (
                    <span className="flex items-center gap-2">
                      <span className="text-stone-500">Remove {displayName}?</span>
                      <button type="button" onClick={() => handleRemove(collab.id)} disabled={isPending} className="text-red-600 underline underline-offset-2">Remove</button>
                      <button type="button" onClick={() => setConfirmRemove(null)} className="text-stone-500 underline underline-offset-2">Keep</button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmRemove(collab.id)} className="underline underline-offset-2 text-stone-500 hover:text-red-600">
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {collaborators.length === 0 && (
          <div className="px-4 py-8 text-center space-y-1">
            <p className="text-sm font-medium">No one else is reviewing yet</p>
            <p className="text-sm text-stone-500">Invite a colleague by email to share the scoring. It is optional: you can review everything yourself.</p>
          </div>
        )}
      </div>

      {(isOwner || reviewerCount > 0) && (
        <Link href={`/review/${opportunityId}`} className="inline-block border border-brand px-4 py-2 text-sm font-medium hover:bg-brand hover:text-brand-foreground transition-colors">
          Open the scoring screen →
        </Link>
      )}

      {/* Assignment */}
      {isOwner && (
        <fieldset className="space-y-3 border border-black/10 p-4">
          <legend className="px-1 text-base font-semibold text-stone-800">Who reviews what</legend>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-start gap-3 border p-3 ${mode === m.id ? "border-black" : "border-black/10"}`}>
                <input type="radio" name="assignment" checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-0.5 accent-black" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{m.label}</span>
                  <span className="block text-sm text-stone-500">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {mode === "split" && (
            <label className="flex items-center gap-2 text-sm">
              Reviewers per application
              <input type="number" min={1} max={10} value={perApp} onChange={(e) => setPerApp(Number(e.target.value) || 1)}
                className="w-16 border border-black/20 px-2 py-1 text-base focus:outline-none focus:border-black" />
            </label>
          )}
          {mode !== "all" && reviewerCount === 0 && (
            <p className="text-sm text-amber-700">Invite at least one reviewer first. Until then, you are the only reviewer.</p>
          )}
          <button type="button" onClick={applyAssignment} disabled={isPending}
            className="border border-brand px-4 py-2 text-sm font-medium hover:bg-brand hover:text-brand-foreground transition-colors disabled:opacity-50">
            {isPending ? "Saving…" : mode === "split" ? "Share out applications" : "Save"}
          </button>
        </fieldset>
      )}

      {isOwner && (
        <fieldset className="space-y-2 border border-black/10 p-4">
          <legend className="px-1 text-base font-semibold text-stone-800">Fairness</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={blind} disabled={isPending} onChange={(e) => toggleBlind(e.target.checked)} className="mt-0.5 accent-black" />
            <span>
              <span className="block text-sm font-medium">Blind review</span>
              <span className="block text-sm text-stone-500">
                Reviewers see the work and the answers, but not names, locations, profiles or CVs. They work in the
                review queue rather than on the board. You still see everything. Reviewers can also step back from any
                application they have a conflict with.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      {/* Permissions */}
      <div className="space-y-3">
        <p className="text-base font-semibold text-stone-800">What each role can do</p>
        <div className="border border-black/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-stone-50">
                <th className="text-left py-2.5 px-4 font-medium text-stone-500 uppercase tracking-wide">Capability</th>
                <th className="py-2.5 px-4 text-center font-medium text-stone-500 uppercase tracking-wide">Owner</th>
                <th className="py-2.5 px-4 text-center font-medium text-stone-500 uppercase tracking-wide">Reviewer</th>
                <th className="py-2.5 px-4 text-center font-medium text-stone-500 uppercase tracking-wide">Observer</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.label} className="border-b border-black/5 last:border-0">
                  <td className="py-2.5 px-4 text-stone-600">{p.label}</td>
                  {[p.owner, p.editor, p.viewer].map((on, i) => (
                    <td key={i} className="py-2.5 px-4 text-center">{on ? <span aria-label="Yes">✓</span> : <span className="text-stone-400" aria-label="No">×</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
