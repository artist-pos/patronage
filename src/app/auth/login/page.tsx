import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign In — Patronage" };

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/auth/signup" className="underline underline-offset-2">
              Create an account
            </Link>
          </p>
        </div>
        {error === "callback" && (
          <p className="text-xs text-destructive">
            Something went wrong. Please try again.
          </p>
        )}
        <AuthForm mode="login" next={next ?? "/onboarding"} />
      </div>
    </div>
  );
}
