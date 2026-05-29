"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { LayoutList, Kanban, Plus, Upload, X } from "lucide-react";
import type { OutreachContact, OutreachContactStatus, OutreachCategory } from "@/types/database";
import { CRMTable } from "./CRMTable";
import { CRMKanban } from "./CRMKanban";
import { ContactDrawer } from "./ContactDrawer";
import { importContactsFromCSV, type CSVContactRow } from "./actions";

const ACTIVE_STATUSES = new Set<OutreachContactStatus>([
  "not_started", "contacted", "no_response", "replied",
  "meeting_booked", "in_conversation", "paused",
]);

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

const CATEGORY_LABELS: Record<OutreachCategory, string> = {
  corporate: "Corporate",
  council_govt: "Council / Govt",
  arts_sector: "Arts Sector",
  education: "Education",
  developer: "Developer",
  investor: "Investor",
  media_platform: "Media / Platform",
  other: "Other",
};

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ contacts }: { contacts: OutreachContact[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10);
  })();

  const overdue = contacts.filter(
    (c) => c.follow_up_date && c.follow_up_date < today && ACTIVE_STATUSES.has(c.status)
  );
  const meetings = contacts.filter(
    (c) => c.meeting_date && c.meeting_date.slice(0, 10) >= weekStart && c.meeting_date.slice(0, 10) <= weekEnd
  );
  const needsAttention = contacts.filter(
    (c) => c.status === "no_response" && c.last_activity_date && c.last_activity_date < (() => {
      const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10);
    })()
  );

  const byStatus = contacts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const keyStatuses: OutreachContactStatus[] = [
    "not_started", "contacted", "no_response", "replied",
    "meeting_booked", "in_conversation",
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {keyStatuses.map((s) => (
          <div key={s} className="border border-border p-3 space-y-1">
            <p className="text-lg font-semibold">{byStatus[s] ?? 0}</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 leading-tight">{STATUS_LABELS[s]}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className={`border p-3 space-y-1 ${overdue.length > 0 ? "border-red-200 bg-red-50" : "border-border"}`}>
          <p className={`text-lg font-semibold ${overdue.length > 0 ? "text-red-600" : ""}`}>{overdue.length}</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Overdue follow-ups</p>
        </div>
        <div className="border border-border p-3 space-y-1">
          <p className="text-lg font-semibold">{meetings.length}</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Meetings this week</p>
        </div>
        <div className={`border p-3 space-y-1 ${needsAttention.length > 0 ? "border-amber-200 bg-amber-50" : "border-border"}`}>
          <p className={`text-lg font-semibold ${needsAttention.length > 0 ? "text-amber-600" : ""}`}>{needsAttention.length}</p>
          <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">Needs attention</p>
        </div>
      </div>
    </div>
  );
}

// ── CSV import ────────────────────────────────────────────────────────────────

function parseCSV(text: string): CSVContactRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return {
      company: row["company"] ?? "",
      contact_name: row["contact_name"] ?? row["contact"] ?? "",
      role: row["role"] ?? "",
      email: row["email"] ?? "",
      category: row["category"] ?? "",
      first_contact_date: row["first_contact_date"] ?? row["first_contact"] ?? "",
      channel: row["channel"] ?? "",
      status: row["status"] ?? "",
      warm_intro_via: row["warm_intro_via"] ?? "",
      last_activity_date: row["last_activity_date"] ?? row["last_activity"] ?? "",
      their_response: row["their_response"] ?? "",
      next_action: row["next_action"] ?? "",
      follow_up_date: row["follow_up_date"] ?? "",
      notes: row["notes"] ?? "",
    };
  });
}

function CSVImportButton({ onImported }: { onImported: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(reader.result as string);
      if (!rows.length) { setToast("No rows found in CSV."); return; }
      startTransition(async () => {
        const result = await importContactsFromCSV(rows);
        if (result.error) { setToast(`Error: ${result.error}`); return; }
        setToast(`Imported ${result.inserted} contacts.`);
        setTimeout(() => setToast(null), 4000);
        onImported();
      });
    };
    reader.readAsText(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="relative">
      <input ref={inputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-import" />
      <label
        htmlFor="csv-import"
        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 border border-border hover:bg-stone-50 transition-colors cursor-pointer ${isPending ? "opacity-50 pointer-events-none" : ""}`}
      >
        <Upload className="w-3.5 h-3.5" />
        {isPending ? "Importing…" : "Import CSV"}
      </label>
      {toast && (
        <div className="absolute top-full right-0 mt-1 bg-black text-white text-xs px-3 py-2 z-10 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Main CRM client ───────────────────────────────────────────────────────────

interface Props {
  initialContacts: OutreachContact[];
}

export function CRMClient({ initialContacts }: Props) {
  const [contacts, setContacts] = useState<OutreachContact[]>(initialContacts);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewContact, setIsNewContact] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<OutreachContactStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<OutreachCategory | "">("");
  const [filterSentFrom, setFilterSentFrom] = useState<"personal" | "patronage" | "">("");

  const filtered = useMemo(() => {
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.company.toLowerCase().includes(q) ||
          c.contact_name?.toLowerCase().includes(q)
      );
    }
    if (filterStatus) result = result.filter((c) => c.status === filterStatus);
    if (filterCategory) result = result.filter((c) => c.category === filterCategory);
    if (filterSentFrom) result = result.filter((c) => c.sent_from === filterSentFrom);
    return result;
  }, [contacts, search, filterStatus, filterCategory, filterSentFrom]);

  const selectedContact = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;

  function handleContactUpdated(updated: OutreachContact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  function handleContactCreated(created: OutreachContact) {
    setContacts((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setIsNewContact(false);
  }

  function handleContactDeleted(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
  }

  function handleStatusChange(contactId: string, newStatus: OutreachContactStatus) {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, status: newStatus } : c))
    );
  }

  const selectCls = "text-xs border border-border bg-transparent px-2 py-1.5 focus:outline-none focus:border-foreground";

  return (
    <div className="space-y-6">
      <StatsBar contacts={contacts} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search company or contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-border bg-transparent px-3 py-1.5 focus:outline-none focus:border-foreground w-56 placeholder:text-stone-300"
        />

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as OutreachContactStatus | "")} className={selectCls}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as OutreachContactStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as OutreachCategory | "")} className={selectCls}>
          <option value="">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as OutreachCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <select value={filterSentFrom} onChange={(e) => setFilterSentFrom(e.target.value as "personal" | "patronage" | "")} className={selectCls}>
          <option value="">All senders</option>
          <option value="personal">Personal</option>
          <option value="patronage">Patronage</option>
        </select>

        {(search || filterStatus || filterCategory || filterSentFrom) && (
          <button
            onClick={() => { setSearch(""); setFilterStatus(""); setFilterCategory(""); setFilterSentFrom(""); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex border border-border">
          <button
            onClick={() => setView("table")}
            className={`p-1.5 transition-colors ${view === "table" ? "bg-black text-white" : "hover:bg-stone-50 text-muted-foreground"}`}
            title="Table view"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`p-1.5 transition-colors ${view === "kanban" ? "bg-black text-white" : "hover:bg-stone-50 text-muted-foreground"}`}
            title="Kanban view"
          >
            <Kanban className="w-4 h-4" />
          </button>
        </div>

        <CSVImportButton onImported={() => window.location.reload()} />

        <button
          onClick={() => { setIsNewContact(true); setSelectedId(null); }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 bg-black text-white hover:opacity-80 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {/* View */}
      {view === "table" ? (
        <CRMTable
          contacts={filtered}
          onSelectContact={setSelectedId}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <CRMKanban
          contacts={filtered}
          onSelectContact={setSelectedId}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Contact drawer */}
      {(selectedId || isNewContact) && (
        <ContactDrawer
          contact={isNewContact ? null : (selectedContact ?? null)}
          onClose={() => { setSelectedId(null); setIsNewContact(false); }}
          onUpdated={handleContactUpdated}
          onCreated={handleContactCreated}
          onDeleted={handleContactDeleted}
        />
      )}
    </div>
  );
}
