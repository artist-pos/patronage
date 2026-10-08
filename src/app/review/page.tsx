import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/get-server-user";

export const metadata: Metadata = { title: "Your reviews", robots: { index: false } };

/** Everything the signed-in person has been invited to review. */
export default async function ReviewIndexPage() {
  const { user } = await getServerUser();
  if (!user) redirect("/auth/login?next=/review");

  const admin = createAdminClient();
  const { data: collabs } = await admin
    .from("opportunity_collaborators")
    .select("role, opportunity:opportunity_id(id, title, organiser, deadline)")
    .eq("profile_id", user.id);

  type Row = { role: string; opportunity: { id: string; title: string; organiser: string | null; deadline: string | null } | { id: string; title: string; organiser: string | null; deadline: string | null }[] | null };
  const items = ((collabs ?? []) as unknown as Row[])
    .map((c) => ({ role: c.role, opp: Array.isArray(c.opportunity) ? c.opportunity[0] : c.opportunity }))
    .filter((c): c is { role: string; opp: NonNullable<typeof c.opp> } => !!c.opp);

  // One opportunity: go straight to it. No extra click.
  if (items.length === 1) redirect(`/review/${items[0].opp.id}`);

  return (
    <div className="ams-comfort mx-auto max-w-2xl px-4 sm:px-6 py-12 space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Review team</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your reviews</h1>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">You haven&apos;t been invited to review anything yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map(({ role, opp }) => (
            <li key={opp.id}>
              <Link href={`/review/${opp.id}`} className="flex items-center justify-between gap-4 border border-black/10 p-4 hover:border-black/40 transition-colors">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{opp.title}</span>
                  <span className="block text-xs text-stone-500">{opp.organiser}</span>
                </span>
                <span className="shrink-0 text-xs text-stone-400">{role === "editor" ? "Review and score" : "View only"} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
