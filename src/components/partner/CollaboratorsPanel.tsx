"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { OpportunityCollaborator } from "@/types/database";
import {
  inviteCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
} from "@/app/partner/opportunities/[id]/collaborators/actions";

interface Props {
  opportunityId: string;
  initialCollaborators: OpportunityCollaborator[];
  isOwner: boolean; // false for collaborators — they can't manage access
}

const ROLE_LABELS: Record<string, string> = {
  viewer: "Viewer — can view applications only",
  editor: "Editor — can view and change statuses",
};

export function CollaboratorsPanel({ opportunityId, initialCollaborators, isOwner }: Props) {
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
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
        // Refresh collaborator list
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
      setCollaborators((prev) =>
        prev.map((c) => c.id === collaboratorId ? { ...c, role: newRole } : c)
      );
    });
  }

  return (
    <div className="space-y-5 border-t border-black/10 pt-6">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Manage Access</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Invite team members to review applications for this opportunity.
        </p>
      </div>

      {/* Current collaborators */}
      {collaborators.length > 0 && (
        <div className="space-y-2">
          {collaborators.map((collab) => (
            <div key={collab.id} className="flex items-center justify-between gap-3 border border-black/10 p-3">
              <div className="flex items-center gap-3 min-w-0">
                {collab.profile?.avatar_url && (
                  <div className="relative w-8 h-8 shrink-0 border border-black/10 overflow-hidden">
                    <Image src={collab.profile.avatar_url} alt="" fill className="object-cover" sizes="32px" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">
                    {collab.profile?.full_name ?? collab.profile?.username ?? "—"}
                  </p>
                  {collab.profile?.username && (
                    <p className="text-xs text-muted-foreground">@{collab.profile.username}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isOwner ? (
                  <select
                    value={collab.role}
                    onChange={(e) => handleRoleChange(collab.id, e.target.value as "viewer" | "editor")}
                    disabled={isPending}
                    className="text-xs border border-black/20 px-2 py-1 bg-transparent cursor-pointer focus:outline-none disabled:opacity-50"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                ) : (
                  <span className="text-xs text-muted-foreground capitalize">{collab.role}</span>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemove(collab.id)}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                    title="Remove collaborator"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {collaborators.length === 0 && (
        <p className="text-xs text-muted-foreground">No collaborators yet.</p>
      )}

      {/* Role descriptions */}
      <div className="space-y-0.5">
        {Object.entries(ROLE_LABELS).map(([r, desc]) => (
          <p key={r} className="text-xs text-muted-foreground"><span className="font-medium capitalize">{r}</span> — {desc.split("—")[1]?.trim()}</p>
        ))}
      </div>

      {/* Invite form (owners only) */}
      {isOwner && (
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="flex-1 text-xs border border-black px-3 py-2 bg-transparent placeholder:text-muted-foreground focus:outline-none"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
              className="text-xs border border-black px-2 py-2 bg-transparent cursor-pointer focus:outline-none shrink-0"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="text-xs border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isPending ? "Inviting…" : "Invite"}
            </button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-green-700">{success}</p>}
        </form>
      )}
    </div>
  );
}
