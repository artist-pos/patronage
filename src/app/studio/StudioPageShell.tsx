import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPendingConfirmationCount } from "@/lib/pending-confirmations";
import { StudioNav } from "./StudioNav";

interface Props {
  username: string;
  activeSection: string;
  children: React.ReactNode;
}

// Lenient completeness signal: count transferred works that are still missing
// the artist's certificate statement. That's the one thing the buyer is
// actually waiting on. Other "polish" gaps (missing dimensions, no doc photos)
// don't drive a sidebar dot.
async function getPendingProvenanceCount(): Promise<number> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;
    const admin = createAdminClient();
    const { count } = await admin
      .from("artworks")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .neq("current_owner_id", user.id)
      .is("certificate_note", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function StudioPageShell({ username, activeSection, children }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Independent counts — fetch in parallel so the shell doesn't wait twice.
  const [pendingProvenanceCount, pendingConfirmationCount] = await Promise.all([
    getPendingProvenanceCount(),
    user ? getPendingConfirmationCount(user.id) : Promise.resolve(0),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and creative practice.
          </p>
        </div>
        <Link
          href={`/${username}`}
          className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
        >
          View profile →
        </Link>
      </div>
      <StudioNav
        activeSection={activeSection}
        sectionDots={{
          provenance: pendingProvenanceCount > 0,
          confirmations: pendingConfirmationCount > 0,
        }}
      >
        {children}
      </StudioNav>
    </div>
  );
}
