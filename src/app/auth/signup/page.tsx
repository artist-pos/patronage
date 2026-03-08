import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create Account — Patronage" };

interface Props {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: Props) {
  const { next } = await searchParams;
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create account
          </h1>
          <p className="text-sm text-muted-foreground">
            Already have one?{" "}
            <Link href="/auth/login" className="underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
        <AuthForm mode="signup" next={next} />
        <p className="text-xs text-muted-foreground">
          You&rsquo;ll receive a confirmation email. After verifying, you can
          complete your artist profile.
        </p>
      </div>
    </div>
  );
}
