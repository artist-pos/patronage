"use client";

import { useState } from "react";
import { Users, Plus, Trash2, Crown, LogOut, ChevronDown, ChevronUp, X, User, Mail, Check } from "lucide-react";
import {
  createCollective,
  leaveCollective,
  deleteCollective,
  getCollectiveMembers,
  addCollectiveMember,
  removeCollectiveMember,
  inviteCollectiveMemberByEmail,
  acceptCollectiveInvitation,
  declineCollectiveInvitation,
} from "@/app/profile/collective-actions";
import { CollaboratorPicker } from "@/components/profile/CollaboratorPicker";
import type { CollectiveMember } from "@/types/database";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

type SelectedArtist = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

interface Props {
  userId: string;
  initialMemberships: CollectiveMember[];
}

export function CollectivesManager({ userId, initialMemberships }: Props) {
  const [memberships, setMemberships] = useState<CollectiveMember[]>(initialMemberships);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [membersMap, setMembersMap] = useState<Record<string, MemberRow[]>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState<Record<string, boolean>>({});
  const [pickerValue, setPickerValue] = useState<Record<string, SelectedArtist[]>>({});
  const [emailInput, setEmailInput] = useState<Record<string, string>>({});
  const [invitingEmail, setInvitingEmail] = useState<Record<string, boolean>>({});

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const pending = memberships.filter(m => m.status === "pending");
  const accepted = memberships.filter(m => m.status === "accepted");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function toggleExpand(collectiveId: string) {
    if (expandedId === collectiveId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(collectiveId);
    if (!membersMap[collectiveId]) {
      setLoadingMembers(collectiveId);
      const result = await getCollectiveMembers(collectiveId);
      if (result.members) setMembersMap(prev => ({ ...prev, [collectiveId]: result.members! }));
      setLoadingMembers(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setFormError(null);
    const result = await createCollective({ name: name.trim(), description: description.trim() || undefined });
    if (result.error) {
      setFormError(result.error);
      setSaving(false);
      return;
    }
    const newMembership: CollectiveMember = {
      id: crypto.randomUUID(),
      collective_id: result.id!,
      user_id: userId,
      role: "admin",
      status: "accepted",
      joined_at: new Date().toISOString(),
      collective: {
        id: result.id!,
        name: name.trim(),
        description: description.trim() || null,
        created_by: userId,
        created_at: new Date().toISOString(),
      },
    };
    setMemberships(prev => [...prev, newMembership]);
    setMembersMap(prev => ({
      ...prev,
      [result.id!]: [{ id: crypto.randomUUID(), user_id: userId, role: "admin", status: "accepted", username: "", full_name: null, avatar_url: null }],
    }));
    setName("");
    setDescription("");
    setShowForm(false);
    showToast("Collective created.");
    setSaving(false);
  }

  async function handleAddMembers(collectiveId: string) {
    const selected = pickerValue[collectiveId] ?? [];
    if (selected.length === 0) return;
    setAddingMember(prev => ({ ...prev, [collectiveId]: true }));
    for (const artist of selected) {
      const result = await addCollectiveMember(collectiveId, artist.id);
      if (!result.error) {
        const newMember: MemberRow = {
          id: crypto.randomUUID(),
          user_id: artist.id,
          role: "member",
          status: "pending",
          username: artist.username,
          full_name: artist.full_name,
          avatar_url: artist.avatar_url,
        };
        setMembersMap(prev => ({
          ...prev,
          [collectiveId]: [...(prev[collectiveId] ?? []), newMember],
        }));
      } else {
        showToast(result.error);
      }
    }
    setPickerValue(prev => ({ ...prev, [collectiveId]: [] }));
    setAddingMember(prev => ({ ...prev, [collectiveId]: false }));
  }

  async function handleInviteByEmail(collectiveId: string) {
    const email = emailInput[collectiveId]?.trim();
    if (!email || !email.includes("@")) return;
    setInvitingEmail(prev => ({ ...prev, [collectiveId]: true }));
    const result = await inviteCollectiveMemberByEmail(collectiveId, email);
    if (result.error) {
      showToast(result.error);
    } else {
      showToast(`Invitation sent to ${email}.`);
      setEmailInput(prev => ({ ...prev, [collectiveId]: "" }));
    }
    setInvitingEmail(prev => ({ ...prev, [collectiveId]: false }));
  }

  async function handleRemoveMember(collectiveId: string, memberId: string, memberUserId: string) {
    const result = await removeCollectiveMember(collectiveId, memberUserId);
    if (!result.error) {
      setMembersMap(prev => ({
        ...prev,
        [collectiveId]: (prev[collectiveId] ?? []).filter(m => m.id !== memberId),
      }));
    } else {
      showToast(result.error);
    }
  }

  async function handleLeave(collectiveId: string) {
    const result = await leaveCollective(collectiveId);
    if (result.error) showToast(result.error);
    else {
      setMemberships(prev => prev.filter(m => m.collective_id !== collectiveId));
      showToast("Left collective.");
    }
  }

  async function handleDelete(collectiveId: string) {
    const result = await deleteCollective(collectiveId);
    if (result.error) showToast(result.error);
    else {
      setMemberships(prev => prev.filter(m => m.collective_id !== collectiveId));
      if (expandedId === collectiveId) setExpandedId(null);
      showToast("Collective deleted.");
    }
  }

  async function handleAccept(collectiveId: string) {
    const result = await acceptCollectiveInvitation(collectiveId);
    if (result.error) showToast(result.error);
    else {
      setMemberships(prev =>
        prev.map(m => m.collective_id === collectiveId ? { ...m, status: "accepted" } : m)
      );
      showToast("Joined collective.");
    }
  }

  async function handleSave() {
    // Commit pending member invites for the currently expanded collective
    if (expandedId && (pickerValue[expandedId]?.length > 0 || emailInput[expandedId]?.includes("@"))) {
      if (pickerValue[expandedId]?.length > 0) await handleAddMembers(expandedId);
      if (emailInput[expandedId]?.includes("@")) await handleInviteByEmail(expandedId);
    }
    // Commit a pending create form
    if (showForm && name.trim()) {
      await handleCreate(new Event("submit") as unknown as React.FormEvent);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleDecline(collectiveId: string) {
    const result = await declineCollectiveInvitation(collectiveId);
    if (result.error) showToast(result.error);
    else {
      setMemberships(prev => prev.filter(m => m.collective_id !== collectiveId));
      showToast("Invitation declined.");
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="text-sm text-muted-foreground border border-border px-3 py-2">{toast}</div>
      )}

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Pending invitations</p>
          <div className="divide-y divide-border border border-border">
            {pending.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.collective?.name ?? "Unnamed collective"}</p>
                    <p className="text-[11px] text-muted-foreground">You&apos;ve been invited to join</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAccept(m.collective_id)}
                    className="flex items-center gap-1 text-xs bg-black text-white px-3 py-1.5 hover:opacity-80 transition-opacity"
                  >
                    <Check className="w-3 h-3" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(m.collective_id)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted memberships */}
      {accepted.length > 0 && (
        <div className="divide-y divide-border border border-border">
          {accepted.map(m => {
            const isAdmin = m.role === "admin";
            const isOpen = expandedId === m.collective_id;
            const members = membersMap[m.collective_id] ?? [];
            const picker = pickerValue[m.collective_id] ?? [];
            const existingUserIds = new Set(members.map(mb => mb.user_id));

            return (
              <div key={m.id}>
                {/* Row header */}
                <div className="flex items-center justify-between px-4 py-3 gap-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(m.collective_id)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left"
                  >
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.collective?.name ?? "Unnamed"}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        {isAdmin ? <><Crown className="w-3 h-3" />Admin</> : "Member"}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-auto" />}
                  </button>
                  <div className="shrink-0">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(m.collective_id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLeave(m.collective_id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Leave
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="border-t border-border bg-stone-50 px-4 py-4 space-y-4">
                    {m.collective?.description && (
                      <p className="text-xs text-muted-foreground">{m.collective.description}</p>
                    )}

                    {/* Members list */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Members</p>
                      {loadingMembers === m.collective_id ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      ) : members.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No members yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {members.map(mb => (
                            <div key={mb.id} className="flex items-center gap-2">
                              {mb.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mb.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                                  <User className="w-3 h-3 text-stone-400" />
                                </div>
                              )}
                              <span className="text-xs flex-1 min-w-0 truncate">
                                {mb.full_name ?? `@${mb.username}`}
                                {mb.role === "admin" && <span className="text-stone-400 ml-1">(admin)</span>}
                                {mb.status === "pending" && <span className="text-stone-400 ml-1">· pending</span>}
                              </span>
                              {isAdmin && mb.user_id !== userId && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(m.collective_id, mb.id, mb.user_id)}
                                  className="text-stone-400 hover:text-destructive transition-colors shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add members (admin only) */}
                    {isAdmin && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Invite members</p>

                        {/* Search existing Patronage users */}
                        <CollaboratorPicker
                          value={picker}
                          onChange={val => setPickerValue(prev => ({ ...prev, [m.collective_id]: val }))}
                          excludeIds={[userId, ...Array.from(existingUserIds)]}
                          label="Search by name or @username"
                        />
                        {picker.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAddMembers(m.collective_id)}
                            disabled={addingMember[m.collective_id]}
                            className="text-sm bg-black text-white px-4 py-2 hover:bg-stone-800 disabled:opacity-50 transition-colors"
                          >
                            {addingMember[m.collective_id] ? "Sending invitations…" : `Invite ${picker.length} artist${picker.length !== 1 ? "s" : ""}`}
                          </button>
                        )}

                        {/* Email invite for non-Patronage users */}
                        <div className="space-y-1 pt-1">
                          <label className="text-[11px] text-muted-foreground">Not on Patronage? Invite by email</label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={emailInput[m.collective_id] ?? ""}
                              onChange={e => setEmailInput(prev => ({ ...prev, [m.collective_id]: e.target.value }))}
                              placeholder="artist@example.com"
                              className="flex-1 text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
                            />
                            <button
                              type="button"
                              onClick={() => handleInviteByEmail(m.collective_id)}
                              disabled={invitingEmail[m.collective_id] || !emailInput[m.collective_id]?.includes("@")}
                              className="text-sm border border-black px-3 py-2 hover:bg-muted disabled:opacity-40 transition-colors whitespace-nowrap"
                            >
                              {invitingEmail[m.collective_id] ? "Sending…" : "Send invite"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {memberships.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">
          You are not part of any collectives yet. Create one below to group your practice with other artists.
        </p>
      )}

      {showForm ? (
        <form onSubmit={handleCreate} className="space-y-3 border border-border p-4">
          <p className="text-sm font-medium">New collective</p>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Auckland Print Collective"
              className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A brief description of your group…"
              rows={2}
              className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black resize-none"
            />
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="text-sm bg-black text-white px-4 py-2 hover:bg-stone-800 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create collective"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setName(""); setDescription(""); setFormError(null); }}
              className="text-sm px-4 py-2 border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm border border-border px-4 py-2 hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create a collective
        </button>
      )}

      {/* Save button */}
      <div className="pt-4 border-t border-border flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-black text-white px-5 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-xs text-muted-foreground">Changes saved.</span>}
      </div>
    </div>
  );
}
