"use client";

import { useState, useTransition } from "react";
import { ChevronUp, ChevronDown, Mail } from "lucide-react";
import type { OutreachContact, OutreachContactStatus } from "@/types/database";
import { updateContact } from "./actions";

const STATUS_LABELS: Record<OutreachContactStatus, string> = {
  not_started: "Not Started",
  contacted: "Contacted",
  no_response: "No Response",
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  in_conversation: "In Conversation",
  rejected: "Rejected",
  completed: "Completed",
  paused: "Paused",
  bounced: "Bounced",
};

const STATUS_STYLES: Record<OutreachContactStatus, string> = {
  not_started:      "bg-stone-100 text-stone-500",
  contacted:        "bg-blue-50 text-blue-700",
  no_response:      "bg-amber-50 text-amber-700",
  replied:          "bg-emerald-50 text-emerald-700",
  meeting_booked:   "bg-violet-50 text-violet-700",
  in_conversation:  "bg-sky-50 text-sky-700",
  rejected:         "bg-red-50 text-red-600",
  completed:        "bg-green-100 text-green-700",
  paused:           "bg-stone-100 text-stone-500",
  bounced:          "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  corporate: "Corporate",
  council_govt: "Council",
  arts_sector: "Arts",
  education: "Education",
  developer: "Developer",
  investor: "Investor",
  media_platform: "Media",
  other: "Other",
};

type SortKey = "company" | "last_activity_date" | "follow_up_date" | "first_contact_date" | "status";

function formatDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function isOverdue(c: OutreachContact) {
  if (!c.follow_up_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  const activeStatuses: OutreachContactStatus[] = [
    "not_started", "contacted", "no_response", "replied",
    "meeting_booked", "in_conversation", "paused",
  ];
  return c.follow_up_date < today && activeStatuses.includes(c.status);
}

function InlineStatusSelect({
  contactId,
  value,
  onChange,
}: {
  contactId: string;
  value: OutreachContactStatus;
  onChange: (s: OutreachContactStatus) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as OutreachContactStatus;
    onChange(newStatus);
    startTransition(async () => {
      await updateContact(contactId, { status: newStatus });
    });
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={isPending}
      className={`text-xs font-medium px-2 py-0.5 border-0 cursor-pointer focus:outline-none rounded-sm ${STATUS_STYLES[value]} disabled:opacity-60`}
    >
      {(Object.keys(STATUS_LABELS) as OutreachContactStatus[]).map((s) => (
        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
      ))}
    </select>
  );
}

function InlineTextEdit({
  contactId,
  field,
  value,
  placeholder,
  onChange,
}: {
  contactId: string;
  field: "next_action";
  value: string | null;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    if (draft === (value ?? "")) return;
    onChange(draft);
    startTransition(async () => {
      await updateContact(contactId, { [field]: draft });
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        onClick={(e) => e.stopPropagation()}
        className="text-xs border border-border px-2 py-0.5 w-full focus:outline-none focus:border-foreground bg-white"
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(value ?? ""); }}
      className={`text-left text-xs truncate max-w-[180px] hover:underline decoration-dashed underline-offset-2 transition-colors ${value ? "text-foreground" : "text-stone-300 italic"} ${isPending ? "opacity-60" : ""}`}
    >
      {value || placeholder}
    </button>
  );
}

interface Props {
  contacts: OutreachContact[];
  onSelectContact: (id: string) => void;
  onStatusChange: (id: string, status: OutreachContactStatus) => void;
}

export function CRMTable({ contacts, onSelectContact, onStatusChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("last_activity_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [localContacts, setLocalContacts] = useState(contacts);

  // Sync external changes
  if (contacts !== localContacts && JSON.stringify(contacts.map((c) => c.id)) !== JSON.stringify(localContacts.map((c) => c.id))) {
    setLocalContacts(contacts);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...localContacts].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  }

  const thCls = "text-left text-[10px] font-medium uppercase tracking-widest text-stone-400 py-2 pr-4 whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none";
  const tdCls = "py-2.5 pr-4 align-top";

  function handleLocalStatusChange(id: string, status: OutreachContactStatus) {
    setLocalContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    onStatusChange(id, status);
  }

  function handleLocalNextActionChange(id: string, val: string) {
    setLocalContacts((prev) => prev.map((c) => (c.id === id ? { ...c, next_action: val } : c)));
  }

  if (!sorted.length) {
    return (
      <div className="border border-border py-16 text-center">
        <p className="text-sm text-muted-foreground">No contacts found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={thCls} onClick={() => toggleSort("company")}>
              <span className="flex items-center gap-1">Company <SortIcon col="company" /></span>
            </th>
            <th className={`${thCls} hidden sm:table-cell`}>Contact</th>
            <th className={`${thCls} hidden md:table-cell`}>Category</th>
            <th className={thCls} onClick={() => toggleSort("status")}>
              <span className="flex items-center gap-1">Status <SortIcon col="status" /></span>
            </th>
            <th className={`${thCls} hidden lg:table-cell`}>Channel</th>
            <th className={thCls} onClick={() => toggleSort("follow_up_date")}>
              <span className="flex items-center gap-1">Follow-up <SortIcon col="follow_up_date" /></span>
            </th>
            <th className={thCls} onClick={() => toggleSort("last_activity_date")}>
              <span className="flex items-center gap-1">Last active <SortIcon col="last_activity_date" /></span>
            </th>
            <th className={`${thCls} hidden xl:table-cell`}>Next action</th>
            <th className={`${thCls} hidden xl:table-cell`}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((c) => {
            const overdue = isOverdue(c);
            return (
              <tr
                key={c.id}
                onClick={() => onSelectContact(c.id)}
                className={`cursor-pointer transition-colors group ${overdue ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-stone-50"}`}
              >
                <td className={tdCls}>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm leading-snug group-hover:underline underline-offset-2">{c.company}</p>
                    {c.contact_name && <p className="text-xs text-muted-foreground sm:hidden">{c.contact_name}</p>}
                  </div>
                </td>
                <td className={`${tdCls} hidden sm:table-cell`}>
                  <div className="space-y-0.5">
                    <p className="text-xs">{c.contact_name ?? "—"}</p>
                    {c.role && <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{c.role}</p>}
                  </div>
                </td>
                <td className={`${tdCls} hidden md:table-cell`}>
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                    {CATEGORY_LABELS[c.category] ?? c.category}
                  </span>
                </td>
                <td className={tdCls}>
                  <InlineStatusSelect
                    contactId={c.id}
                    value={c.status}
                    onChange={(s) => handleLocalStatusChange(c.id, s)}
                  />
                </td>
                <td className={`${tdCls} hidden lg:table-cell`}>
                  <span className="text-xs text-muted-foreground capitalize">{c.channel?.replace(/_/g, " ") ?? "—"}</span>
                </td>
                <td className={tdCls}>
                  <span className={`text-xs ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {formatDate(c.follow_up_date)}
                  </span>
                </td>
                <td className={tdCls}>
                  <span className="text-xs text-muted-foreground">{formatDate(c.last_activity_date)}</span>
                </td>
                <td className={`${tdCls} hidden xl:table-cell`}>
                  <InlineTextEdit
                    contactId={c.id}
                    field="next_action"
                    value={c.next_action}
                    placeholder="Add next action…"
                    onChange={(v) => handleLocalNextActionChange(c.id, v)}
                  />
                </td>
                <td className={`${tdCls} hidden xl:table-cell`}>
                  {c.email && (
                    <a
                      href={`/admin/outreach?to=${encodeURIComponent(c.email)}&name=${encodeURIComponent(c.contact_name ?? c.company)}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Send email"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
