"use client";

import { useState, useTransition } from "react";
import type { OpportunityCollaborator } from "@/types/database";
import {
  inviteCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
} from "@/app/partner/opportunities/[id]/collaborators/actions";

interface Props {
  opportunityId: string;
  initialCollaborators: OpportunityCollaborator[];
  isOwner: boolean;
}

const PERMISSIONS = [
  { label: "View applications",      owner: true, editor: true,  viewer: true  },
  { label: "Score & leave notes",    owner: true, editor: true,  viewer: false },
  { label: "Move application stage", owner: true, editor: true,  viewer: false },
  { label: "Message applicants",     owner: true, editor: true,  viewer: false },
  { label: "Edit opportunity setup", owner: true, editor: false, viewer: false },
  { label: "Invite collaborators",   owner: true, editor: false, viewer: false },
  { label: "Export data",            owner: true, editor: true,  viewer: false },
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

export function CollaboratorsPanel({ opportunityId, initialCollaborators, isOwner }: Props) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("editor");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(msg: string, type: "success" | "error") {
    if (type === "success") { setSuccess(msg); setTimeout(() => setSuccess(null), 4000); }
    else { setError(msg); setTimeout(() => setError(null), 5000); }
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await inviteCollaborator(opportunityId, email.trim(), role);
      if (result.error) {
        flash(result.error, "error");
      } else {
        flash(`Invitation sent to ${email.trim()}.`, "success");
        setEmail("");
        setShowInvite(false);
        window.location.reload();
      }
    });
  }

  function handleRemove(collaboratorId: string) {
    startTransition(async () => {
      const result = await removeCollaborator(opportunityId, collaboratorId);
      if (result.error) { flash(result.error, "error"); return; }
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
    });
  }

  function handleRoleChange(collaboratorId: string, newRole: "viewer" | "editor") {
    startTransition(async () => {
      const result = await updateCollaboratorRole(opportunityId, collaboratorId, newRole);
      if (result.error) { flash(result.error, "error"); return; }
      setCollaborators((prev) => prev.map((c) => c.id === collaboratorId ? { ...c, role: newRole } : c));
    });
  }

  return (
    <div className="max-w-2xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Collaborators</h2>
          <p className="text-sm text-stone-500 leading-relaxed">
            Invite people to review applications.{" "}
            <strong className="text-foreground font-semibold">Editors</strong>{" "}
            can move applications and leave scores.{" "}
            <strong className="text-foreground font-semibold">Viewers</strong>{" "}
            can read everything but can&apos;t change status.
          </p>
        </div>
        {isOwner && (
          <button type="button" onClick={() => setShowInvite((v) => !v)}
            className="shrink-0 bg-black text-white text-sm px-4 py-2 hover:bg-black/80 transition-colors font-medium">
            + Invite collaborator
          </button>
        )}
      </div>

      {/* Invite form (inline, toggled) */}
      {showInvite && isOwner && (
        <form onSubmit={handleInvite} className="border border-black/10 p-4 space-y-3 bg-stone-50/50">
          <p className="text-sm font-medium">Invite by email</p>
          <div className="flex gap-2">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@organisation.nz" required
              className="flex-1 text-sm border border-black/20 px-3 py-2 bg-white focus:outline-none focus:border-black" />
            <select value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
              className="text-sm border border-black/20 px-2 py-2 bg-white focus:outline-none focus:border-black">
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="submit" disabled={isPending || !email.trim()}
              className="text-sm border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-50">
              {isPending ? "Inviting…" : "Invite"}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {success && <p className="text-xs text-emerald-600">{success}</p>}
        </form>
      )}

      {/* Collaborator list */}
      <div className="border border-black/10 divide-y divide-black/5">
        {collaborators.map((collab) => {
          const displayName = collab.profile?.full_name ?? collab.profile?.username ?? "—";
          const abbr = initials(displayName);
          const isYou = false; // no current user context here
          void isYou;
          return (
            <div key={collab.id} className="flex items-center gap-4 px-4 py-3">
              {/* Avatar initials */}
              <div className="w-9 h-9 rounded-full bg-stone-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                {abbr}
              </div>
              {/* Name + email */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {displayName}
                </p>
                {collab.profile?.username && (
                  <p className="text-xs text-stone-400 truncate">@{collab.profile.username}</p>
                )}
              </div>
              {/* Role */}
              <div className="shrink-0">
                {isOwner ? (
                  <select value={collab.role} onChange={(e) => handleRoleChange(collab.id, e.target.value as "viewer" | "editor")}
                    disabled={isPending}
                    className="text-xs border border-black/20 px-2 py-1.5 bg-transparent focus:outline-none focus:border-black cursor-pointer disabled:opacity-50 capitalize">
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                ) : (
                  <span className="text-xs text-stone-400 capitalize">{collab.role}</span>
                )}
              </div>
              {/* Last seen */}
              <span className="text-xs text-stone-400 w-20 text-right shrink-0 hidden sm:block">
                {relativeTime(collab.invited_at)}
              </span>
              {/* Remove */}
              {isOwner && (
                <button type="button" onClick={() => handleRemove(collab.id)} disabled={isPending}
                  className="text-stone-300 hover:text-foreground transition-colors disabled:opacity-50 w-5 text-center shrink-0 text-base leading-none">
                  ×
                </button>
              )}
            </div>
          );
        })}

        {collaborators.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-stone-400">No collaborators yet.</p>
          </div>
        )}
      </div>

      {/* Role permissions table */}
      <div className="space-y-3">
        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Role permissions</p>
        <div className="border border-black/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/10 bg-stone-50">
                <th className="text-left py-2.5 px-4 font-medium text-stone-400 uppercase tracking-wide text-[10px]">Capability</th>
                <th className="py-2.5 px-4 text-center font-medium text-stone-400 uppercase tracking-wide text-[10px]">Owner</th>
                <th className="py-2.5 px-4 text-center font-medium text-stone-400 uppercase tracking-wide text-[10px]">Editor</th>
                <th className="py-2.5 px-4 text-center font-medium text-stone-400 uppercase tracking-wide text-[10px]">Viewer</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.label} className="border-b border-black/5 last:border-0">
                  <td className="py-2.5 px-4 text-stone-600">{p.label}</td>
                  <td className="py-2.5 px-4 text-center">{p.owner ? <span className="text-foreground">✓</span> : <span className="text-stone-200">×</span>}</td>
                  <td className="py-2.5 px-4 text-center">{p.editor ? <span className="text-foreground">✓</span> : <span className="text-stone-200">×</span>}</td>
                  <td className="py-2.5 px-4 text-center">{p.viewer ? <span className="text-foreground">✓</span> : <span className="text-stone-200">×</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
