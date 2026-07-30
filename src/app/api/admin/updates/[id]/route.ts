import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/updates/<id>   body: { admin_hidden: boolean }
 *
 * Toggles the migration-177 moderation flag on a single studio update. Hiding it
 * drops the post from the landing page and /feed for signed-out visitors, and
 * nowhere else — every other surface, and every signed-in viewer, is unaffected.
 * Nothing is deleted and the artist is never notified.
 *
 * Admin/owner only. Auth is checked inside this handler (not in middleware) and
 * the write goes through the service-role client so it isn't subject to the
 * artist-ownership RLS policy on project_updates.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const adminHidden = (body as { admin_hidden?: unknown })?.admin_hidden;
  if (typeof adminHidden !== "boolean") {
    return NextResponse.json(
      { error: "admin_hidden must be a boolean" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_updates")
    .update({ admin_hidden: adminHidden })
    .eq("id", id)
    .select("id, admin_hidden")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Update not found" }, { status: 404 });

  // Only the two surfaces that read the flag. Every other page renders the post
  // regardless of admin_hidden, so their caches don't care that it changed.
  revalidatePath("/feed");
  // Landing page filters after an unstable_cache'd fetch whose rows carry
  // admin_hidden — so the tag has to go, not just the path.
  revalidateTag("home-data", "max");

  return NextResponse.json({ id: data.id, admin_hidden: data.admin_hidden });
}
