import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create Account — Patronage" };

const VALID_ROLES = ["artist", "patron", "partner"] as const;
type Role = (typeof VALID_ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  artist:  "Creative",
  patron:  "Patron",
  partner: "Partner",
};

const ROLES = [
  {
    value: "artist" as const,
    label: "I'm an artist",
    description: "Build your profile, find opportunities, share your practice.",
  },
  {
    value: "patron" as const,
    label: "I support artists",
    description: "Follow artists, collect work, discover new practices.",
  },
  {
    value: "partner" as const,
    label: "I represent an organisation",
    description: "List opportunities and reach artists directly.",
  },
];

interface Props {
  searchParams: Promise<{ next?: string; role?: string }>;
}

export default async function SignupPage({ searchParams }: Props) {
  const { next, role: roleParam } = await searchParams;
  const role = VALID_ROLES.includes(roleParam as Role) ? (roleParam as Role) : null;

  // Where to land after auth if no role is set. When a role IS set, the callback
  // routes through /onboarding/role using the top-level role param instead.
  const resolvedNext = next ?? "/onboarding/role";

  // No role selected — show role picker
  if (!role) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl space-y-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Join Patronage</h1>
            <p className="text-sm text-muted-foreground">
              How will you use Patronage? Choose your role to get started.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {ROLES.map(({ value, label, description }) => (
              <Link
                key={value}
                href={`/auth/signup?role=${value}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
                className="block text-left border border-black p-6 space-y-2 hover:bg-muted/40 transition-colors"
              >
                <p className="font-semibold text-base">{label}</p>
                <p className="text-sm text-muted-foreground leading-snug">{description}</p>
              </Link>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Role selected — show signup form
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <Link
            href="/auth/signup"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 inline-block"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Join as a {ROLE_LABELS[role]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Already have one?{" "}
            <Link href="/auth/login" className="underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
        <AuthForm mode="signup" next={resolvedNext} role={role} />
        <p className="text-xs text-muted-foreground">
          You&rsquo;ll receive a confirmation email. After verifying, you can
          complete your profile.
        </p>
      </div>
    </div>
  );
}
