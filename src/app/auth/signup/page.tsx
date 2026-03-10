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

interface Props {
  searchParams: Promise<{ next?: string; role?: string }>;
}

export default async function SignupPage({ searchParams }: Props) {
  const { next, role: roleParam } = await searchParams;
  const role = VALID_ROLES.includes(roleParam as Role) ? (roleParam as Role) : null;

  // If a role was pre-selected, route through the role page so it auto-applies
  const resolvedNext = next ?? (role ? `/onboarding/role?role=${role}` : undefined);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {role ? `Join as a ${ROLE_LABELS[role]}` : "Create account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Already have one?{" "}
            <Link href="/auth/login" className="underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
        <AuthForm mode="signup" next={resolvedNext} />
        <p className="text-xs text-muted-foreground">
          You&rsquo;ll receive a confirmation email. After verifying, you can
          complete your profile.
        </p>
      </div>
    </div>
  );
}
