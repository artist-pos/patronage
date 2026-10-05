"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { getProfileById } from "@/lib/profiles";
import { VIEW_AS_COOKIE, ALLOWED_VIEW_AS_ROLES, type ViewAsRole } from "@/lib/view-as";

/**
 * Sets the "View As" cookie to override the visible role for owner accounts.
 * Pass null to clear the override and return to the owner view.
 *
 * Security: always verifies the actual DB role is "owner" before setting.
 */
export async function setViewAs(role: ViewAsRole | null): Promise<{ error?: string }> {
  const { user } = await getServerUser();
  if (!user) return { error: "Not authenticated" };

  const profile = await getProfileById(user.id);
  if (!profile || profile.role !== "owner") {
    return { error: "Only owner accounts can use View As" };
  }

  const cookieStore = await cookies();

  if (role === null) {
    cookieStore.delete(VIEW_AS_COOKIE);
  } else {
    if (!ALLOWED_VIEW_AS_ROLES.includes(role)) {
      return { error: "Invalid role" };
    }
    cookieStore.set(VIEW_AS_COOKIE, role, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // 24 hours — auto-expires so the override doesn't persist forever
      maxAge: 60 * 60 * 24,
    });
  }

  // Revalidate the current page so the role change takes effect immediately
  revalidatePath("/", "layout");

  return {};
}
