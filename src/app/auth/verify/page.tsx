import { resendConfirmation } from "@/app/auth/confirm/actions";
import { PendingButton } from "@/components/auth/PendingButton";

export const metadata = { title: "Check Your Email — Patronage" };

interface Props {
  searchParams: Promise<{ email?: string; role?: string }>;
}

export default async function VerifyPage({ searchParams }: Props) {
  const { email, role } = await searchParams;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We&rsquo;ve sent a confirmation link to{" "}
            {email ? <strong className="text-foreground">{email}</strong> : "your email address"}.
            Click it to verify your account and complete your artist profile.
          </p>
          <p className="text-xs text-muted-foreground">
            Didn&rsquo;t receive it? Check your spam folder, or send a fresh link below.
          </p>
        </div>

        <form action={resendConfirmation} className="space-y-3">
          {role && <input type="hidden" name="role" value={role} />}
          <input
            name="email"
            type="email"
            required
            defaultValue={email}
            placeholder="you@example.com"
            className="w-full text-sm border border-border px-3 py-2 bg-background focus:outline-none focus:border-black"
          />
          <PendingButton className="w-full text-sm bg-black text-white px-4 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-60">
            Resend confirmation email
          </PendingButton>
        </form>
      </div>
    </div>
  );
}
