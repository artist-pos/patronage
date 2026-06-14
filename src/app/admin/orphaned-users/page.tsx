export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { sendWelcomeDm } from "@/lib/welcome-dm";

export const metadata = { title: "Orphaned Users — Admin — Patronage" };

const VALID_ROLES = ["artist", "patron", "partner"] as const;
type Role = (typeof VALID_ROLES)[number];

async function assignRole(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as string;
  if (!userId || !VALID_ROLES.includes(role as Role)) return;

  const admin = createAdminClient();

  const fallbackUsername = email
    ?.split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 30)
    + "_" + userId.replace(/-/g, "").slice(0, 6);

  const isArtist = role === "artist";

  await admin.from("profiles").upsert(
    {
      id: userId,
      username: fallbackUsername,
      email: email?.toLowerCase().trim() ?? null,
      role,
      is_active: true,
      ...(isArtist && { marketing_subscription: true, weekly_digest: true }),
    },
    { onConflict: "id", ignoreDuplicates: false }
  );

  if (isArtist && email) {
    await admin
      .from("subscribers")
      .upsert({ email: email.toLowerCase().trim() }, { onConflict: "email", ignoreDuplicates: true });
  }

  sendWelcomeDm(userId, role).catch(console.error);

  redirect("/admin/orphaned-users");
}

export default async function OrphanedUsersPage() {
  const admin_check = await isAdmin();
  if (!admin_check) redirect("/");

  const admin = createAdminClient();

  // Fetch all confirmed auth users
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const allAuthUsers = authData?.users ?? [];

  // Fetch all profile IDs
  const { data: profileRows } = await admin.from("profiles").select("id");
  const profileIds = new Set((profileRows ?? []).map((p) => p.id));

  // Orphaned = confirmed email, but no profiles row
  const orphaned = allAuthUsers.filter(
    (u) => u.email_confirmed_at && !profileIds.has(u.id)
  );

  // Pending = unverified email, no profiles row
  const pending = allAuthUsers.filter(
    (u) => !u.email_confirmed_at && !profileIds.has(u.id)
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Orphaned Users</h1>
        <p className="text-xs text-muted-foreground">
          Auth users with no profile row — either unverified or verified but never completed role selection.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Verified — no profile</h2>
        <p className="text-xs text-muted-foreground">{orphaned.length} user{orphaned.length !== 1 ? "s" : ""} · confirmed email but never selected a role. Assign one to create their profile.</p>
      </div>

      {orphaned.length === 0 ? (
        <p className="text-sm text-muted-foreground">None — all good.</p>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Email</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Signed up</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Confirmed</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Assign role</th>
              </tr>
            </thead>
            <tbody>
              {orphaned.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-stone-700">{u.email}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("en-NZ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {u.email_confirmed_at ? new Date(u.email_confirmed_at).toLocaleDateString("en-NZ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {VALID_ROLES.map((role) => (
                        <form key={role} action={assignRole}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="email" value={u.email ?? ""} />
                          <input type="hidden" name="role" value={role} />
                          <button
                            type="submit"
                            className="text-xs px-3 py-1 border border-black hover:bg-black hover:text-white transition-colors capitalize"
                          >
                            {role === "artist" ? "Creative" : role === "patron" ? "Patron" : "Partner"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-2 pt-4">
        <h2 className="text-sm font-medium">Pending verification</h2>
        <p className="text-xs text-muted-foreground">{pending.length} user{pending.length !== 1 ? "s" : ""} · signed up but haven&apos;t clicked the confirmation email yet.</p>
      </div>

      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Email</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Signed up</th>
                <th className="text-left px-4 py-2 font-medium text-xs uppercase tracking-widest text-stone-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-stone-700">{u.email}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("en-NZ") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-stone-100 text-stone-600 rounded-full px-3 py-1">Awaiting email confirmation</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
