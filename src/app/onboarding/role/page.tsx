import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileById } from "@/lib/profiles";
import { sendWelcomeDigest } from "@/lib/digest-send";
import { issueEmailVerification } from "@/lib/email-verification";
import { sendWelcomeDm } from "@/lib/welcome-dm";
import { isSelectableCountry } from "@/lib/constants/countries";
import { isOrgCategory } from "@/lib/org-categories";
import {
  SIGNUP_CONTEXT_COOKIE,
  decodeSignupContext,
  toDisciplineEnums,
} from "@/lib/signup-context";

export const metadata = { title: "Get Started — Patronage" };

const VALID_ROLES = ["artist", "patron", "partner"] as const;
type Role = (typeof VALID_ROLES)[number];

async function applyRole(role: string, next?: string | null) {
  "use server";
  if (!VALID_ROLES.includes(role as Role)) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const baseUsername = user.email
    ?.split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 30) || user.id.slice(0, 8);

  const isArtist = role === "artist" || role === "owner";
  const isOAuth = user.app_metadata?.provider === "google";

  // Attribution and seeded matching preferences, left behind by whichever
  // public surface sent this person here (e.g. the opportunity page banner).
  // Read before the upsert so both land in a single write.
  const cookieStore = await cookies();
  const signupCtx = decodeSignupContext(
    cookieStore.get(SIGNUP_CONTEXT_COOKIE)?.value
  );

  // Only artists get preferences seeded — a patron or partner has no use for
  // a discipline list, and guessing one would show up as wrong data on their
  // profile rather than a helpful default.
  const seededDisciplines = isArtist ? toDisciplineEnums(signupCtx?.disciplines) : [];

  const profileData = {
    id: user.id,
    username: baseUsername,
    email: user.email?.toLowerCase().trim() ?? null,
    role,
    is_active: true,
    // Google has already proved this address, so an OAuth signup is verified
    // on arrival and never sees the banner. Password signups owe us a click.
    ...(isOAuth && { email_verified_at: new Date().toISOString() }),
    ...(isArtist && { marketing_subscription: true, weekly_digest: true }),
    ...(signupCtx && {
      signup_source: signupCtx.source,
      ...(signupCtx.opportunityId && {
        signup_source_opportunity_id: signupCtx.opportunityId,
      }),
      ...(signupCtx.ref && { signup_source_ref: signupCtx.ref }),
    }),
    ...(isArtist && signupCtx?.disciplines?.length && {
      // The listing's own wording, kept as the free-text medium…
      medium: signupCtx.disciplines,
    }),
    // …and the constrained enum where a term mapped onto one.
    ...(seededDisciplines.length > 0 && { disciplines: seededDisciplines }),
    // Partners arriving from the partners page already said what they do,
    // and from a regional CTA they already said where. Neither should be
    // asked twice.
    ...(role === "partner" && isOrgCategory(signupCtx?.orgCategory) && {
      org_category: signupCtx.orgCategory,
    }),
    ...(signupCtx?.regionId && { region_id: signupCtx.regionId }),
    // Which organisation's invitation produced this account (187). Attribution
    // only: it gives them no claim on the artist and appears nowhere public.
    ...(isArtist && signupCtx?.invitedByOrgId && {
      invited_by_org_id: signupCtx.invitedByOrgId,
    }),
    // Their organisation had a name on file. Offered as the starting value
    // because a blank profile is the main reason people abandon onboarding.
    ...(isArtist && signupCtx?.fullName && { full_name: signupCtx.fullName }),
    ...(isArtist && signupCtx?.city && { city: signupCtx.city }),
    // "Global" and other listing-only country values are not places a person
    // lives, so they never become a profile country.
    ...(isArtist && isSelectableCountry(signupCtx?.country) && {
      country: signupCtx.country,
    }),
  };

  let { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profileData, { onConflict: "id", ignoreDuplicates: false });

  // onConflict only watches `id` — a generated username that collides with
  // someone else's fails the write on the column's own unique constraint
  // instead. Retry once with a disambiguated handle before giving up.
  if (upsertError?.code === "23505") {
    ({ error: upsertError } = await supabase
      .from("profiles")
      .upsert(
        { ...profileData, username: `${baseUsername}_${user.id.replace(/-/g, "").slice(0, 6)}` },
        { onConflict: "id", ignoreDuplicates: false }
      ));
  }

  // Never redirect the user onward as if this succeeded when it didn't — that's
  // exactly how an auth.users row ends up with no matching profile ("orphaned").
  if (upsertError) {
    const params = new URLSearchParams({ role, error: "1" });
    if (next) params.set("next", next);
    redirect(`/onboarding/role?${params.toString()}`);
  }

  // Close the loop on the invitation so the inviting organisation can see that
  // this one converted. Not awaited for correctness of the signup: a failure
  // here costs a row in their funnel, not the artist's account.
  if (isArtist && signupCtx?.inviteToken) {
    const admin = createAdminClient();
    await admin
      .from("artist_invitations")
      .update({
        status: "joined",
        joined_at: new Date().toISOString(),
        joined_profile_id: user.id,
      })
      .eq("token", signupCtx.inviteToken);
  }

  // One signup, one attribution. Clearing it stops a second account made in
  // the same browser inheriting the first one's source.
  if (signupCtx) cookieStore.delete(SIGNUP_CONTEXT_COOKIE);

  // Everything below runs after the response. A bare floating promise would
  // not: this function ends in redirect(), which throws, and the serverless
  // invocation can be frozen before the send resolves — silently costing a
  // password signup the one email that lets them apply.
  after(async () => {
    // The upsert above set weekly_digest for artists, but the first issue
    // waits until the address is proved (190): mailing an unverified address
    // risks a bounce, and bounces cost the sender reputation every later
    // digest needs. /auth/verify/[token] sends it once confirmed.
    if (isArtist && isOAuth && user.email) {
      await sendWelcomeDigest(user.email.toLowerCase().trim()).catch(console.error);
    }

    // Password signups get the link that switches on applications and the digest.
    if (!isOAuth) await issueEmailVerification(user.id).catch(console.error);

    // Role-specific welcome DM from @patronagenz.
    await sendWelcomeDm(user.id, role).catch(console.error);
  });

  // Resume an interrupted flow (e.g. a free listing) if a safe next was carried.
  // An onboarding route is never something to resume: /auth/signup carries
  // next=/onboarding/role as its own default, and honouring that sent the
  // artist back here, where a role now exists, and on to /settings. Only a
  // destination outside onboarding is a real interrupted flow.
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("/onboarding") ? next : null;
  // signup=1 lets the client capture signup_completed. This action runs exactly
  // once per account, so it is the only honest marker of a finished signup.
  // Artists take one more step before landing: the four fields the matching
  // filter needs, so the page they arrive on has something on it. Everyone
  // else has no disciplines to match on and goes straight to their dashboard.
  // An artist always goes through the profile step: it is what makes the page
  // after it worth arriving on, and no stale next may skip it. /profile/edit
  // is AuthForm's own default and a redirect stub to /studio, so honouring it
  // here landed new artists in the thirteen-field form this step replaced.
  // A genuine resume target rides along and is honoured once the step is done.
  const destination = isArtist
    ? `/onboarding/profile${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`
    : (safeNext ?? "/dashboard");
  redirect(`${destination}${destination.includes("?") ? "&" : "?"}signup=1`);
}

async function setRole(formData: FormData) {
  "use server";
  await applyRole(formData.get("role") as string, formData.get("next") as string | null);
}

interface Props {
  searchParams: Promise<{ role?: string; next?: string; error?: string }>;
}

export default async function SelectRolePage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const profile = await getProfileById(user.id);
  if (profile?.role) redirect("/settings");

  // Pre-selected role from the homepage join buttons — skip the selection UI.
  // Not when `error` is set: that means applyRole already tried and failed for
  // this role once, so retrying automatically would just loop.
  const { role: roleParam, next, error } = await searchParams;
  if (roleParam && VALID_ROLES.includes(roleParam as Role) && !error) {
    await applyRole(roleParam, next);
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
          {error === "1" && (
            <p className="text-sm text-destructive">
              Something went wrong saving that. Please try again.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {roles.map(({ value, label, description }) => (
            <form key={value} action={setRole}>
              <input type="hidden" name="role" value={value} />
              {next && <input type="hidden" name="next" value={next} />}
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
