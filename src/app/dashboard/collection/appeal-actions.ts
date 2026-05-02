"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const APPEAL_BUCKET = "artwork-source-documents";

/**
 * Holder appeals an artist's decline. The artist's veto isn't a final
 * adjudication — there are real cases (artist died and estate is wrong,
 * artist forgot they sold the work, falling-out between collector and artist)
 * where the holder needs a path to be heard. The appeal lands in an admin
 * queue; admin resolves narrowly per docs/dispute-resolution.md.
 */
export async function appealDecline(form: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const claimId = String(form.get("claimId") ?? "");
  const message = String(form.get("message") ?? "").trim();
  const evidence = form.get("evidence");

  if (!claimId) return { error: "Missing claim ID." };
  if (!message) return { error: "Tell us why you're appealing." };
  if (message.length > 2000) return { error: "Message is too long (2000 char max)." };

  const admin = createAdminClient();
  const { data: claim } = await admin
    .from("holder_attribution_claims")
    .select("id, holder_id, status, artwork_id")
    .eq("id", claimId)
    .maybeSingle();

  if (!claim)                          return { error: "Claim not found." };
  if (claim.holder_id !== user.id)     return { error: "You can only appeal your own records." };
  if (claim.status !== "declined")     return { error: "Only declined claims can be appealed." };

  let evidencePath: string | null = null;
  if (evidence instanceof File && evidence.size > 0) {
    if (evidence.size > 20 * 1024 * 1024) {
      return { error: "Evidence file must be under 20 MB." };
    }
    const ext = (evidence.name.split(".").pop() || "pdf")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "pdf";
    const id = randomBytes(8).toString("hex");
    evidencePath = `${user.id}/${claim.artwork_id}/appeal-${id}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(APPEAL_BUCKET)
      .upload(evidencePath, evidence, {
        contentType: evidence.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) return { error: uploadError.message };
  }

  const { error } = await admin
    .from("holder_attribution_claims")
    .update({
      decline_appealed_at: new Date().toISOString(),
      decline_appeal_message: message,
      decline_appeal_evidence: evidencePath,
    })
    .eq("id", claimId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/collection/${claim.artwork_id}`);
  revalidatePath("/admin/dispute-resolution");
  return {};
}
