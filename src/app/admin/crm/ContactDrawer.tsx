"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { X, Mail, Linkedin, Trash2, Plus, ChevronDown } from "lucide-react";
import type {
  OutreachContact,
  OutreachActivity,
  OutreachCategory,
  OutreachContactStatus,
  OutreachChannel,
  OutreachSentFrom,
  OutreachActivityType,
} from "@/types/database";
import {
  createContact,
  updateContact,
  deleteContact,
  addActivity,
  getActivities,
  type CreateContactInput,
} from "./actions";

const STATUS_OPTIONS: { value: OutreachContactStatus; label: string }[] = [
  { value: "not_started",     label: "Not Started" },
  { value: "contacted",       label: "Contacted" },
  { value: "no_response",     label: "No Response" },
  { value: "replied",         label: "Replied" },
  { value: "meeting_booked",  label: "Meeting Booked" },
  { value: "in_conversation", label: "In Conversation" },
  { value: "rejected",        label: "Rejected" },
  { value: "completed",       label: "Completed" },
  { value: "paused",          label: "Paused" },
  { value: "bounced",         label: "Bounced" },
];

const CATEGORY_OPTIONS: { value: OutreachCategory; label: string }[] = [
  { value: "corporate",      label: "Corporate" },
  { value: "council_govt",   label: "Council / Govt" },
  { value: "arts_sector",    label: "Arts Sector" },
  { value: "education",      label: "Education" },
  { value: "developer",      label: "Developer" },
  { value: "investor",       label: "Investor" },
  { value: "media_platform", label: "Media / Platform" },
  { value: "other",          label: "Other" },
];

const CHANNEL_OPTIONS: { value: OutreachChannel; label: string }[] = [
  { value: "email",         label: "Email" },
  { value: "linkedin",      label: "LinkedIn" },
  { value: "phone",         label: "Phone" },
  { value: "in_person",     label: "In Person" },
  { value: "contact_form",  label: "Contact Form" },
  { value: "intro_email",   label: "Intro Email" },
  { value: "instagram",     label: "Instagram" },
  { value: "other",         label: "Other" },
];

const ACTIVITY_TYPE_OPTIONS: { value: OutreachActivityType; label: string }[] = [
  { value: "email_sent",       label: "Email sent" },
  { value: "email_received",   label: "Email received" },
  { value: "meeting",          label: "Meeting" },
  { value: "phone_call",       label: "Phone call" },
  { value: "linkedin_message", label: "LinkedIn message" },
  { value: "note",             label: "Note" },
  { value: "status_change",    label: "Status change" },
];

function formatActivityDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

const ACTIVITY_ICONS: Partial<Record<OutreachActivityType, string>> = {
  email_sent: "✉",
  email_received: "📩",
  meeting: "📅",
  phone_call: "📞",
  linkedin_message: "💼",
  note: "📝",
  status_change: "↺",
};

interface Props {
  contact: OutreachContact | null;
  onClose: () => void;
  onUpdated: (c: OutreachContact) => void;
  onCreated: (c: OutreachContact) => void;
  onDeleted: (id: string) => void;
}

export function ContactDrawer({ contact, onClose, onUpdated, onCreated, onDeleted }: Props) {
  const isNew = !contact;
  const [isPending, startTransition] = useTransition();
  const [activities, setActivities] = useState<OutreachActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state mirrors contact fields
  const [company, setCompany] = useState(contact?.company ?? "");
  const [contactName, setContactName] = useState(contact?.contact_name ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(contact?.linkedin_url ?? "");
  const [category, setCategory] = useState<OutreachCategory>(contact?.category ?? "other");
  const [status, setStatus] = useState<OutreachContactStatus>(contact?.status ?? "not_started");
  const [channel, setChannel] = useState<OutreachChannel | "">(contact?.channel ?? "");
  const [warmIntroVia, setWarmIntroVia] = useState(contact?.warm_intro_via ?? "");
  const [firstContactDate, setFirstContactDate] = useState(contact?.first_contact_date ?? "");
  const [lastActivityDate, setLastActivityDate] = useState(contact?.last_activity_date ?? "");
  const [followUpDate, setFollowUpDate] = useState(contact?.follow_up_date ?? "");
  const [meetingDate, setMeetingDate] = useState(
    contact?.meeting_date ? contact.meeting_date.slice(0, 16) : ""
  );
  const [theirResponse, setTheirResponse] = useState(contact?.their_response ?? "");
  const [nextAction, setNextAction] = useState(contact?.next_action ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [sentFrom, setSentFrom] = useState<OutreachSentFrom>(contact?.sent_from ?? "personal");

  // Quick-add activity
  const [activityType, setActivityType] = useState<OutreachActivityType>("note");
  const [activityDesc, setActivityDesc] = useState("");

  // Track if dirty (has unsaved changes)
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-fresh ref — updated by useEffect after React flushes state, so setTimeout never reads stale values
  const latestInput = useRef<CreateContactInput>(buildInput());

  // Load activities on open (existing contact only)
  useEffect(() => {
    if (!contact) return;
    setLoadingActivities(true);
    getActivities(contact.id).then((acts) => {
      setActivities(acts);
      setLoadingActivities(false);
    });
  }, [contact?.id]);

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Keep latestInput ref in sync after React flushes state updates
  useEffect(() => {
    latestInput.current = buildInput();
  }, [company, contactName, role, email, linkedinUrl, category, status, channel,
      warmIntroVia, firstContactDate, lastActivityDate, followUpDate, meetingDate,
      theirResponse, nextAction, notes, sentFrom]);

  function buildInput(): CreateContactInput {
    return {
      company,
      contact_name: contactName,
      role,
      email,
      linkedin_url: linkedinUrl,
      category,
      status,
      channel: channel || undefined,
      warm_intro_via: warmIntroVia,
      first_contact_date: firstContactDate,
      last_activity_date: lastActivityDate,
      follow_up_date: followUpDate,
      meeting_date: meetingDate,
      their_response: theirResponse,
      next_action: nextAction,
      notes,
      sent_from: sentFrom,
    };
  }

  async function handleSave() {
    if (!contact) return;
    const input = buildInput();
    setSaveStatus("saving");
    startTransition(async () => {
      const res = await updateContact(contact.id, input);
      if (!res.error) {
        setDirty(false);
        setSaveStatus("saved");
        onUpdated({ ...contact, ...input, updated_at: new Date().toISOString() });
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("idle");
        setToast(res.error ?? "Save failed.");
      }
    });
  }

  function scheduleAutoSave() {
    setDirty(true);
    if (isNew) return; // New contacts save on submit, not auto
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!contact) return;
      // latestInput.current is kept fresh by useEffect — no stale closure
      const input = latestInput.current;
      startTransition(async () => {
        const res = await updateContact(contact.id, input);
        if (!res.error) {
          setDirty(false);
          setSaveStatus("saved");
          onUpdated({ ...contact, ...input, updated_at: new Date().toISOString() });
          setTimeout(() => setSaveStatus("idle"), 2000);
        }
      });
    }, 1500);
  }

  function field(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setter(e.target.value);
      scheduleAutoSave();
    };
  }

  async function handleSaveNew() {
    if (!company.trim()) return;
    startTransition(async () => {
      const input = buildInput();
      const res = await createContact(input);
      if (res.error) { setToast(res.error); return; }
      // Fetch the created contact back
      onCreated({
        id: res.id!,
        ...input,
        company: input.company,
        contact_name: input.contact_name ?? null,
        role: input.role ?? null,
        email: input.email ?? null,
        linkedin_url: input.linkedin_url ?? null,
        channel: input.channel ?? null,
        warm_intro_via: input.warm_intro_via ?? null,
        first_contact_date: input.first_contact_date ?? null,
        last_activity_date: input.last_activity_date ?? null,
        follow_up_date: input.follow_up_date ?? null,
        meeting_date: input.meeting_date ?? null,
        their_response: input.their_response ?? null,
        next_action: input.next_action ?? null,
        notes: input.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  }

  async function handleDelete() {
    if (!contact) return;
    if (!confirm(`Delete ${contact.company}? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteContact(contact.id);
      if (res.error) { setToast(res.error); return; }
      onDeleted(contact.id);
    });
  }

  async function handleLogActivity() {
    if (!contact || !activityDesc.trim()) return;
    startTransition(async () => {
      const res = await addActivity(contact.id, activityType, activityDesc);
      if (res.error) { setToast(res.error); return; }
      const newActivity: OutreachActivity = {
        id: crypto.randomUUID(),
        contact_id: contact.id,
        activity_type: activityType,
        description: activityDesc.trim(),
        created_at: new Date().toISOString(),
      };
      setActivities((prev) => [newActivity, ...prev]);
      setActivityDesc("");
      setToast("Activity logged.");
      setTimeout(() => setToast(null), 2000);
    });
  }

  const inputCls = "w-full text-xs border border-border bg-transparent px-2.5 py-1.5 focus:outline-none focus:border-foreground transition-colors placeholder:text-stone-300";
  const selectCls = `${inputCls} cursor-pointer`;
  const labelCls = "text-[10px] font-medium uppercase tracking-widest text-stone-400";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] bg-background border-l border-border overflow-y-auto shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <p className="text-sm font-semibold">{isNew ? "New Contact" : (contact?.company ?? "")}</p>
          <div className="flex items-center gap-2">
            {!isNew && (
              <>
                {saveStatus === "saving" && <span className="text-[10px] text-muted-foreground">Saving…</span>}
                {saveStatus === "saved" && <span className="text-[10px] text-stone-400">Saved</span>}
                <button
                  onClick={handleSave}
                  disabled={isPending || !dirty}
                  className="text-xs font-medium px-3 py-1 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-30"
                >
                  Save
                </button>
              </>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* Their Response — shown prominently at top for existing contacts */}
            {!isNew && (
              <div className="space-y-1.5">
                <label className={labelCls}>Their Response</label>
                <textarea
                  value={theirResponse}
                  onChange={field(setTheirResponse)}
                  rows={3}
                  placeholder="What did they say?"
                  className={`${inputCls} resize-y bg-stone-50 font-medium`}
                />
              </div>
            )}

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label className={labelCls}>Company *</label>
                <input type="text" value={company} onChange={field(setCompany)} placeholder="Acme Corp" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Contact Name</label>
                <input type="text" value={contactName} onChange={field(setContactName)} placeholder="Jane Smith" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Role</label>
                <input type="text" value={role} onChange={field(setRole)} placeholder="Head of Marketing" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Email</label>
                <div className="relative">
                  <input type="email" value={email} onChange={field(setEmail)} placeholder="jane@company.com" className={inputCls} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>LinkedIn</label>
                <input type="url" value={linkedinUrl} onChange={field(setLinkedinUrl)} placeholder="linkedin.com/in/…" className={inputCls} />
              </div>
            </div>

            {/* Status + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => { setStatus(e.target.value as OutreachContactStatus); scheduleAutoSave(); }} className={selectCls}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Category</label>
                <select value={category} onChange={(e) => { setCategory(e.target.value as OutreachCategory); scheduleAutoSave(); }} className={selectCls}>
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Channel</label>
                <select value={channel} onChange={(e) => { setChannel(e.target.value as OutreachChannel | ""); scheduleAutoSave(); }} className={selectCls}>
                  <option value="">— select —</option>
                  {CHANNEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Sent From</label>
                <select value={sentFrom} onChange={(e) => { setSentFrom(e.target.value as OutreachSentFrom); scheduleAutoSave(); }} className={selectCls}>
                  <option value="personal">Personal (blakeaitkenwork@gmail.com)</option>
                  <option value="patronage">Patronage (hello@patronage.nz)</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>First Contact</label>
                <input type="date" value={firstContactDate} onChange={field(setFirstContactDate)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Last Activity</label>
                <input type="date" value={lastActivityDate} onChange={field(setLastActivityDate)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Follow-up Date</label>
                <input type="date" value={followUpDate} onChange={field(setFollowUpDate)} className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Meeting Date/Time</label>
                <input type="datetime-local" value={meetingDate} onChange={field(setMeetingDate)} className={inputCls} />
              </div>
            </div>

            {/* Warm intro */}
            <div className="space-y-1.5">
              <label className={labelCls}>Warm Intro Via</label>
              <input type="text" value={warmIntroVia} onChange={field(setWarmIntroVia)} placeholder="e.g. John at Creative NZ" className={inputCls} />
            </div>

            {/* Their response — new contact only (no prominent section yet) */}
            {isNew && (
              <div className="space-y-1.5">
                <label className={labelCls}>Their Response</label>
                <textarea value={theirResponse} onChange={field(setTheirResponse)} rows={2} placeholder="What did they say?" className={`${inputCls} resize-y`} />
              </div>
            )}

            {/* Next action */}
            <div className="space-y-1.5">
              <label className={labelCls}>Next Action</label>
              <input type="text" value={nextAction} onChange={field(setNextAction)} placeholder="e.g. Follow up in 2 weeks" className={inputCls} />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className={labelCls}>Notes</label>
              <textarea value={notes} onChange={field(setNotes)} rows={3} placeholder="Context, background, ideas…" className={`${inputCls} resize-y`} />
            </div>

            {/* Quick links */}
            {!isNew && (email || linkedinUrl) && (
              <div className="flex gap-2">
                {email && (
                  <a
                    href={`/admin/outreach?to=${encodeURIComponent(email)}&name=${encodeURIComponent(contactName || company)}`}
                    className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-stone-50 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" /> Send email
                  </a>
                )}
                {linkedinUrl && (
                  <a
                    href={linkedinUrl.startsWith("http") ? linkedinUrl : `https://${linkedinUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs border border-border px-3 py-1.5 hover:bg-stone-50 transition-colors"
                  >
                    <Linkedin className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                )}
              </div>
            )}

            {/* Save button for new contact */}
            {isNew && (
              <button
                onClick={handleSaveNew}
                disabled={isPending || !company.trim()}
                className="w-full text-sm font-medium py-2.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Create Contact"}
              </button>
            )}

            {/* Activity log (existing contacts) */}
            {!isNew && (
              <div className="space-y-3 border-t border-border pt-5">
                <p className={labelCls}>Activity Log</p>

                {/* Quick add */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value as OutreachActivityType)}
                      className={`${selectCls} flex-shrink-0 w-auto`}
                    >
                      {ACTIVITY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activityDesc}
                      onChange={(e) => setActivityDesc(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleLogActivity(); }}
                      placeholder="Add a note or log activity…"
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      onClick={handleLogActivity}
                      disabled={isPending || !activityDesc.trim()}
                      className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 bg-black text-white hover:opacity-80 transition-opacity disabled:opacity-40 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Log
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                {loadingActivities ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No activity logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((act) => (
                      <div key={act.id} className="flex gap-2.5 text-xs">
                        <span className="shrink-0 text-base leading-none mt-0.5">{ACTIVITY_ICONS[act.activity_type] ?? "•"}</span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="leading-snug">{act.description}</p>
                          <p className="text-[10px] text-muted-foreground">{formatActivityDate(act.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Delete */}
            {!isNew && (
              <div className="border-t border-border pt-4">
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete contact
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className="sticky bottom-0 bg-black text-white text-xs px-4 py-3 text-center">
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
