import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";

export const metadata = { title: "Get Started — Patronage" };

async function setRole(formData: FormData) {
  "use server";
  const role = formData.get("role") as string;
  if (!["artist", "patron", "partner"].includes(role)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Derive a fallback username from the email (stripped, lowercased)
  const fallbackUsername = user.email
    ?.split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 30) ?? user.id.slice(0, 8);

  // Patrons and partners don't require admin approval — activate immediately.
  // Artists default to is_active: true too (admin can deactivate if needed).
  const isArtist = role === "artist";
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: fallbackUsername,
      role,
      is_active: true,
      ...(isArtist && { marketing_subscription: true, weekly_digest: true }),
    },
    { onConflict: "id", ignoreDuplicates: false }
  );

  // Auto-subscribe artists to the weekly digest
  if (isArtist && user.email) {
    await supabase
      .from("subscribers")
      .upsert({ email: user.email.toLowerCase().trim() }, { onConflict: "email", ignoreDuplicates: true });
  }

  redirect(isArtist ? "/onboarding?welcome=1" : "/onboarding");
}

export default async function SelectRolePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  // Already has a role — skip to onboarding
  if (profile?.role) redirect("/onboarding");

  const roles = [
    {
      value: "artist",
      label: "Artist",
      description: "Build your portfolio & list works.",
    },
    {
      value: "patron",
      label: "Patron",
      description: "Follow artists, enquire about works, and apply for operational roles and industry jobs.",
    },
    {
      value: "partner",
      label: "Partner",
      description: "List grants & commissions.",
    },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Patronage</h1>
          <p className="text-sm text-muted-foreground">
            Choose how you&apos;ll use the platform. This can&apos;t be changed later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {roles.map(({ value, label, description }) => (
            <form key={value} action={setRole}>
              <input type="hidden" name="role" value={value} />
              <button
                type="submit"
                className="w-full h-full text-left border border-black p-6 space-y-2 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                <p className="font-semibold text-base">{label}</p>
                <p className="text-sm text-muted-foreground leading-snug">{description}</p>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
