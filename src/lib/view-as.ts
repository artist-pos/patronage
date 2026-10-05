import { cookies } from "next/headers";
import { cache } from "react";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";

export const VIEW_AS_COOKIE = "patronage_view_as";
export const ALLOWED_VIEW_AS_ROLES = ["artist", "patron", "partner"] as const;
export type ViewAsRole = (typeof ALLOWED_VIEW_AS_ROLES)[number];

/**
 * Returns the effective role for the current user, respecting the "View As"
 * cookie when the real profile role is "owner".
 *
 * Security: the cookie is only respected when the actual DB role is "owner".
 * Non-owners cannot fake a role via the cookie.
 *
 * React.cache'd so every RSC in a single render shares the result.
 */
export const getEffectiveRole = cache(async (): Promise<{
  effectiveRole: string | null;
  actualRole: string | null;
  isViewingAs: boolean;
  viewAsRole: ViewAsRole | null;
}> => {
  const { user } = await getServerUser();
  if (!user) {
    return { effectiveRole: null, actualRole: null, isViewingAs: false, viewAsRole: null };
  }

  const profile = await getProfileById(user.id);
  const actualRole = profile?.role ?? null;

  // Only owners can use View As
  if (actualRole !== "owner") {
    return { effectiveRole: actualRole, actualRole, isViewingAs: false, viewAsRole: null };
  }

  const cookieStore = await cookies();
  const viewAsCookie = cookieStore.get(VIEW_AS_COOKIE)?.value;

  if (viewAsCookie && ALLOWED_VIEW_AS_ROLES.includes(viewAsCookie as ViewAsRole)) {
    const viewAsRole = viewAsCookie as ViewAsRole;
    return {
      effectiveRole: viewAsRole,
      actualRole,
      isViewingAs: true,
      viewAsRole,
    };
  }

  return { effectiveRole: actualRole, actualRole, isViewingAs: false, viewAsRole: null };
});
