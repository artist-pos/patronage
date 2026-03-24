/**
 * Collaborator authorization helpers for partner pipelines.
 * Centralises all access checks so dashboard pages and actions stay consistent.
 */

import { createClient } from "@/lib/supabase/server";

export type CollaboratorPermission = "view" | "edit";

/**
 * Check whether the current user can access an opportunity pipeline.
 * Admins bypass all checks. Owners of the opportunity have full access.
 * Collaborators get view or edit depending on their role.
 */
export async function canAccessOpportunity(
  userId: string,
  userRole: string,
  opportunityId: string,
  requiredPermission: CollaboratorPermission = "view"
): Promise<boolean> {
  // Admins can access everything
  if (userRole === "admin" || userRole === "owner") return true;

  const supabase = await createClient();

  // Check if user owns the opportunity
  const { data: opp } = await supabase
    .from("opportunities")
    .select("profile_id")
    .eq("id", opportunityId)
    .single();

  if (opp?.profile_id === userId) return true;

  // Check if user is a collaborator
  const { data: collab } = await supabase
    .from("opportunity_collaborators")
    .select("role")
    .eq("opportunity_id", opportunityId)
    .eq("profile_id", userId)
    .maybeSingle();

  if (!collab) return false;
  if (requiredPermission === "view") return true;
  if (requiredPermission === "edit") return collab.role === "editor";

  return false;
}
