import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Resolve an auth user id by email without scanning every user.
 *
 * The service role bypasses RLS, so we can query `auth.users` directly
 * via PostgREST's schema selector — that's an O(1) indexed lookup. If the
 * auth schema isn't exposed (some self-hosted setups), we fall back to a
 * paginated `listUsers` scan that still beats fetching all 1000 in one
 * shot because it short-circuits on the first match.
 *
 * Returns null when no user with that email exists.
 */
export async function findAuthUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;

  // Fast path: indexed query against auth.users.
  try {
    const { data, error } = await admin
      .schema("auth")
      .from("users")
      .select("id")
      .ilike("email", normalised)
      .limit(1)
      .maybeSingle();
    if (!error && data?.id) return data.id as string;
    // If the auth schema isn't exposed via PostgREST, error.code will be
    // something like 'PGRST106' or '42P01'. Fall through to the slow path.
  } catch {
    // Likewise — fall through.
  }

  // Slow path: paginated scan, short-circuit on first match.
  const PAGE_SIZE = 1000;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalised);
    if (match) return match.id;
    if (data.users.length < PAGE_SIZE) return null; // last page reached
  }
  return null;
}
