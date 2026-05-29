"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  OutreachContact,
  OutreachActivity,
  OutreachCategory,
  OutreachContactStatus,
  OutreachChannel,
  OutreachSentFrom,
  OutreachActivityType,
} from "@/types/database";

function getAdmin() {
  return createAdminClient();
}

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getCRMContacts(): Promise<OutreachContact[]> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("outreach_contacts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActivities(contactId: string): Promise<OutreachActivity[]> {
  const admin = getAdmin();
  const { data, error } = await admin
    .from("outreach_activity")
    .select("*")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Create ────────────────────────────────────────────────────────────────────

export type CreateContactInput = {
  company: string;
  contact_name?: string;
  role?: string;
  email?: string;
  linkedin_url?: string;
  category: OutreachCategory;
  status: OutreachContactStatus;
  channel?: OutreachChannel;
  warm_intro_via?: string;
  first_contact_date?: string;
  last_activity_date?: string;
  follow_up_date?: string;
  meeting_date?: string;
  their_response?: string;
  next_action?: string;
  notes?: string;
  sent_from: OutreachSentFrom;
};

export async function createContact(input: CreateContactInput): Promise<{ id?: string; error?: string }> {
  await assertAdmin();
  const admin = getAdmin();
  const { data, error } = await admin
    .from("outreach_contacts")
    .insert({
      company: input.company.trim(),
      contact_name: input.contact_name?.trim() || null,
      role: input.role?.trim() || null,
      email: input.email?.trim() || null,
      linkedin_url: input.linkedin_url?.trim() || null,
      category: input.category,
      status: input.status,
      channel: input.channel || null,
      warm_intro_via: input.warm_intro_via?.trim() || null,
      first_contact_date: input.first_contact_date || null,
      last_activity_date: input.last_activity_date || null,
      follow_up_date: input.follow_up_date || null,
      meeting_date: input.meeting_date || null,
      their_response: input.their_response?.trim() || null,
      next_action: input.next_action?.trim() || null,
      notes: input.notes?.trim() || null,
      sent_from: input.sent_from,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/crm");
  return { id: data.id };
}

// ── Update ────────────────────────────────────────────────────────────────────

export type UpdateContactInput = Partial<Omit<CreateContactInput, "company"> & { company: string }>;

export async function updateContact(
  id: string,
  input: UpdateContactInput
): Promise<{ error?: string }> {
  await assertAdmin();
  const admin = getAdmin();

  const patch: Record<string, unknown> = {};
  if (input.company !== undefined) patch.company = input.company.trim();
  if (input.contact_name !== undefined) patch.contact_name = input.contact_name?.trim() || null;
  if (input.role !== undefined) patch.role = input.role?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.linkedin_url !== undefined) patch.linkedin_url = input.linkedin_url?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.status !== undefined) patch.status = input.status;
  if (input.channel !== undefined) patch.channel = input.channel || null;
  if (input.warm_intro_via !== undefined) patch.warm_intro_via = input.warm_intro_via?.trim() || null;
  if (input.first_contact_date !== undefined) patch.first_contact_date = input.first_contact_date || null;
  if (input.last_activity_date !== undefined) patch.last_activity_date = input.last_activity_date || null;
  if (input.follow_up_date !== undefined) patch.follow_up_date = input.follow_up_date || null;
  if (input.meeting_date !== undefined) patch.meeting_date = input.meeting_date || null;
  if (input.their_response !== undefined) patch.their_response = input.their_response?.trim() || null;
  if (input.next_action !== undefined) patch.next_action = input.next_action?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.sent_from !== undefined) patch.sent_from = input.sent_from;

  const { error } = await admin.from("outreach_contacts").update(patch).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/crm");
  return {};
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteContact(id: string): Promise<{ error?: string }> {
  await assertAdmin();
  const admin = getAdmin();
  const { error } = await admin.from("outreach_contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/crm");
  return {};
}

// ── Activity log ──────────────────────────────────────────────────────────────

export async function addActivity(
  contactId: string,
  activityType: OutreachActivityType,
  description: string
): Promise<{ error?: string }> {
  await assertAdmin();
  const admin = getAdmin();
  const { error } = await admin.from("outreach_activity").insert({
    contact_id: contactId,
    activity_type: activityType,
    description: description.trim(),
  });
  if (error) return { error: error.message };

  // Keep last_activity_date fresh
  await admin
    .from("outreach_contacts")
    .update({ last_activity_date: new Date().toISOString().slice(0, 10) })
    .eq("id", contactId);

  return {};
}

// ── CSV import ────────────────────────────────────────────────────────────────

export type CSVContactRow = {
  company: string;
  contact_name?: string;
  role?: string;
  email?: string;
  category?: string;
  first_contact_date?: string;
  channel?: string;
  status?: string;
  warm_intro_via?: string;
  last_activity_date?: string;
  their_response?: string;
  next_action?: string;
  follow_up_date?: string;
  notes?: string;
};

const CATEGORY_MAP: Record<string, OutreachCategory> = {
  "corporate": "corporate",
  "council / govt": "council_govt",
  "council_govt": "council_govt",
  "arts sector": "arts_sector",
  "arts_sector": "arts_sector",
  "education": "education",
  "developer": "developer",
  "investor": "investor",
  "media / platform": "media_platform",
  "media_platform": "media_platform",
  "other": "other",
};

const STATUS_MAP: Record<string, OutreachContactStatus> = {
  "not started": "not_started",
  "not_started": "not_started",
  "contacted": "contacted",
  "no response": "no_response",
  "no_response": "no_response",
  "replied": "replied",
  "meeting booked": "meeting_booked",
  "meeting_booked": "meeting_booked",
  "in conversation": "in_conversation",
  "in_conversation": "in_conversation",
  "rejected": "rejected",
  "completed": "completed",
  "paused": "paused",
  "bounced": "bounced",
};

const CHANNEL_MAP: Record<string, OutreachChannel> = {
  "email": "email",
  "linkedin": "linkedin",
  "phone": "phone",
  "in person": "in_person",
  "in_person": "in_person",
  "contact form": "contact_form",
  "contact_form": "contact_form",
  "intro email": "intro_email",
  "intro_email": "intro_email",
  "instagram": "instagram",
  "other": "other",
};

function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // "17 May 2026" or "17 May"
  const withYear = /^\d{1,2}\s+\w+\s+\d{4}$/.test(trimmed) ? trimmed : `${trimmed} 2026`;
  const d = new Date(withYear);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export async function importContactsFromCSV(
  rows: CSVContactRow[]
): Promise<{ inserted: number; skipped: number; error?: string }> {
  await assertAdmin();
  const admin = getAdmin();

  const records = rows
    .filter((r) => r.company?.trim())
    .map((r) => ({
      company: r.company.trim(),
      contact_name: r.contact_name?.trim() || null,
      role: r.role?.trim() || null,
      email: r.email?.trim() || null,
      category: CATEGORY_MAP[r.category?.toLowerCase().trim() ?? ""] ?? "other",
      status: STATUS_MAP[r.status?.toLowerCase().trim() ?? ""] ?? "not_started",
      channel: CHANNEL_MAP[r.channel?.toLowerCase().trim() ?? ""] ?? null,
      warm_intro_via: r.warm_intro_via?.trim() || null,
      first_contact_date: parseDate(r.first_contact_date),
      last_activity_date: parseDate(r.last_activity_date),
      follow_up_date: parseDate(r.follow_up_date),
      their_response: r.their_response?.trim() || null,
      next_action: r.next_action?.trim() || null,
      notes: r.notes?.trim() || null,
      sent_from: "personal" as OutreachSentFrom,
    }));

  if (!records.length) return { inserted: 0, skipped: rows.length };

  const { error } = await admin.from("outreach_contacts").insert(records);
  if (error) return { inserted: 0, skipped: records.length, error: error.message };

  revalidatePath("/admin/crm");
  return { inserted: records.length, skipped: rows.length - records.length };
}
