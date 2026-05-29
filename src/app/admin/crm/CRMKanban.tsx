"use client";

import { useState, useTransition } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, useDroppable, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import type { OutreachContact, OutreachContactStatus } from "@/types/database";
import { updateContact, addActivity } from "./actions";

const COLUMNS: { id: OutreachContactStatus; label: string }[] = [
  { id: "not_started",     label: "Not Started" },
  { id: "contacted",       label: "Contacted" },
  { id: "no_response",     label: "No Response" },
  { id: "replied",         label: "Replied" },
  { id: "meeting_booked",  label: "Meeting Booked" },
  { id: "in_conversation", label: "In Conversation" },
  { id: "paused",          label: "Paused" },
  { id: "completed",       label: "Completed" },
  { id: "rejected",        label: "Rejected" },
];

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

const CATEGORY_COLORS: Record<string, string> = {
  corporate:      "bg-blue-100 text-blue-700",
  council_govt:   "bg-violet-100 text-violet-700",
  arts_sector:    "bg-amber-100 text-amber-700",
  education:      "bg-emerald-100 text-emerald-700",
  developer:      "bg-sky-100 text-sky-700",
  investor:       "bg-pink-100 text-pink-700",
  media_platform: "bg-orange-100 text-orange-700",
  other:          "bg-stone-100 text-stone-600",
};

function formatDate(d: string | null) {
  if (!d) return null;
  const dt = new Date(d.includes("T") ? d : d + "T00:00:00");
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function isOverdueFollowup(c: OutreachContact) {
  if (!c.follow_up_date) return false;
  return c.follow_up_date < new Date().toISOString().slice(0, 10);
}

function CRMCard({
  contact,
  onClick,
  isDragging = false,
}: {
  contact: OutreachContact;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const overdue = isOverdueFollowup(contact);
  return (
    <div
      onClick={onClick}
      className={`bg-background border border-border p-3 space-y-2 cursor-pointer hover:border-stone-400 transition-colors select-none ${isDragging ? "opacity-40" : ""}`}
    >
      <p className="text-sm font-semibold leading-snug">{contact.company}</p>
      {contact.contact_name && (
        <p className="text-xs text-muted-foreground">{contact.contact_name}{contact.role ? `, ${contact.role}` : ""}</p>
      )}
      <div className="flex flex-wrap items-center gap-1">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[contact.category] ?? "bg-stone-100 text-stone-600"}`}>
          {CATEGORY_LABELS[contact.category] ?? contact.category}
        </span>
        {contact.sent_from === "personal" && (
          <span className="text-[10px] text-stone-400">personal</span>
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {contact.follow_up_date ? (
          <span className={overdue ? "text-red-600 font-medium" : ""}>
            ↺ {formatDate(contact.follow_up_date)}
          </span>
        ) : <span />}
        {contact.last_activity_date && (
          <span>{formatDate(contact.last_activity_date)}</span>
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  contact,
  onClick,
}: {
  contact: OutreachContact;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: contact.id });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      <CRMCard contact={contact} onClick={onClick} isDragging={isDragging} />
    </div>
  );
}

function KanbanColumn({
  col,
  contacts,
  onSelectContact,
}: {
  col: { id: OutreachContactStatus; label: string };
  contacts: OutreachContact[];
  onSelectContact: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="flex flex-col min-w-[200px] w-[200px] shrink-0">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500 leading-none">{col.label}</p>
        <span className="text-[10px] text-stone-400">{contacts.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 min-h-[80px] p-1 transition-colors ${isOver ? "bg-stone-100" : ""}`}
      >
        {contacts.map((c) => (
          <DraggableCard key={c.id} contact={c} onClick={() => onSelectContact(c.id)} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  contacts: OutreachContact[];
  onSelectContact: (id: string) => void;
  onStatusChange: (id: string, status: OutreachContactStatus) => void;
}

export function CRMKanban({ contacts, onSelectContact, onStatusChange }: Props) {
  const [localContacts, setLocalContacts] = useState(contacts);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync incoming changes
  if (JSON.stringify(contacts.map((c) => c.id + c.status)) !== JSON.stringify(localContacts.map((c) => c.id + c.status))) {
    setLocalContacts(contacts);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const draggingContact = draggingId ? localContacts.find((c) => c.id === draggingId) ?? null : null;

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setDraggingId(null);
    if (!over) return;

    const newStatus = over.id as OutreachContactStatus;
    const contact = localContacts.find((c) => c.id === active.id);
    if (!contact || contact.status === newStatus) return;

    const prevStatus = contact.status;

    // Optimistic update
    setLocalContacts((prev) => prev.map((c) => c.id === active.id ? { ...c, status: newStatus } : c));
    onStatusChange(active.id as string, newStatus);

    startTransition(async () => {
      const [res] = await Promise.all([
        updateContact(active.id as string, { status: newStatus }),
        addActivity(
          active.id as string,
          "status_change",
          `Status changed from ${prevStatus.replace(/_/g, " ")} to ${newStatus.replace(/_/g, " ")}`
        ),
      ]);

      if (res.error) {
        // Revert
        setLocalContacts((prev) => prev.map((c) => c.id === active.id ? { ...c, status: prevStatus } : c));
        onStatusChange(active.id as string, prevStatus);
      }
    });
  }

  const contactsByStatus = Object.fromEntries(
    COLUMNS.map((col) => [col.id, localContacts.filter((c) => c.status === col.id)])
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDraggingId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              contacts={contactsByStatus[col.id] ?? []}
              onSelectContact={onSelectContact}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {draggingContact && (
          <div className="w-[200px] opacity-90 rotate-2 shadow-xl">
            <CRMCard contact={draggingContact} onClick={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
