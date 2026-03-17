import { createAdminClient } from "@/lib/supabase/admin";

const PATRONAGE_USERNAME = "patronagenz";

const WELCOME_MESSAGES: Record<string, string> = {
  artist: `Welcome to Patronage. A few things worth doing first:

— Add a few works to your portfolio
— Check the opportunities board for open deadlines
— Post a studio update if you have something in progress

When you sell or gift a work, you can mark it as collected and credit the new owner — they'll get a provenance link to verify ownership.

If you have questions or feedback, reply here — this is a real inbox.`,

  patron: `Welcome to Patronage. Here's how to get started:

— Browse the Artists directory to find and follow artists
— When an artist adds a work to your collection, you'll be able to confirm and view it from your dashboard
— Check the Opportunities board if you're looking for roles in the arts

If you have questions, reply here — this is a real inbox.`,

  partner: `Welcome to Patronage. Here's how to get started:

— Submit an opportunity listing from your dashboard — grants, residencies, open calls, and jobs are all welcome
— Once listed, you can manage applications and track engagement from your partner dashboard
— Listings are free and reach artists across Aotearoa and Australia

If you have questions, reply here — this is a real inbox.`,
};

export async function sendWelcomeDm(newUserId: string, role: string): Promise<void> {
  const admin = createAdminClient();

  // Look up @patronagenz profile
  const { data: patronageProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", PATRONAGE_USERNAME)
    .single();

  if (!patronageProfile) return; // @patronagenz account not set up yet

  const patronageId = patronageProfile.id;
  if (patronageId === newUserId) return; // safety check

  const message = WELCOME_MESSAGES[role] ?? WELCOME_MESSAGES.patron;

  // Ensure UUIDs are ordered for the unique conversation pair
  const [participantA, participantB] = [patronageId, newUserId].sort();

  // Get or create conversation
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", participantA)
    .eq("participant_b", participantB)
    .maybeSingle();

  let conversationId: string;

  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ participant_a: participantA, participant_b: participantB })
      .select("id")
      .single();

    if (error || !created) return;
    conversationId = created.id;
  }

  // Insert the welcome message from @patronagenz
  await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_id: patronageId,
    content: message,
    is_read: false,
    message_type: "text",
  });
}
