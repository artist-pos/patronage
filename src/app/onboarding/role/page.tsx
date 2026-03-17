import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/profiles";
import { sendWelcomeDigest } from "@/lib/digest";
import { sendWelcomeDm } from "@/lib/welcome-dm";

export const metadata = { title: "Get Started — Patronage" };

const VALID_ROLES = ["artist", "patron", "partner"] as const;
type Role = (typeof VALID_ROLES)[number];

async function applyRole(role: string) {
  "use server";
  if (!VALID_ROLES.includes(role as Role)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const fallbackUsername = user.email
    ?.split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 30) ?? user.id.slice(0, 8);

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

  if (isArtist && user.email) {
    const email = user.email.toLowerCase().trim();
    await supabase
      .from("subscribers")
      .upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
    sendWelcomeDigest(email).catch(console.error);
  }

  // Send role-specific welcome DM from @patronagenz
  sendWelcomeDm(user.id, role).catch(console.error);

  redirect(isArtist ? "/onboarding?welcome=1" : "/onboarding");
}

async function setRole(formData: FormData) {
  "use server";
  await applyRole(formData.get("role") as string);
}

interface Props {
  searchParams: Promise<{ role?: string }>;
}

export default async function SelectRolePage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  if (profile?.role) redirect("/onboarding");

  // Pre-selected role from the homepage join buttons — skip the selection UI
  const { role: roleParam } = await searchParams;
  if (roleParam && VALID_ROLES.includes(roleParam as Role)) {
    await applyRole(roleParam);
  }

  const roles = [
    {
      value: "artist",
      label: "I'm an artist",
      description: "Build your profile, find opportunities, share your practice.",
    },
    {
      value: "patron",
      label: "I support artists",
      description: "Follow artists, collect work, discover new practices.",
    },
    {
      value: "partner",
      label: "I represent an organisation",
      description: "List opportunities and reach artists directly.",
    },
  ] as const;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">How will you use Patronage?</h1>
          <p className="text-sm text-muted-foreground">
            Choose your role. This can&apos;t be changed later.
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
