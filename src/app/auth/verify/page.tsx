export const metadata = { title: "Check Your Email — Patronage" };

export default function VerifyPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&rsquo;ve sent a confirmation link to your email address. Click it
          to verify your account and complete your artist profile.
        </p>
        <p className="text-xs text-muted-foreground">
          Didn&rsquo;t receive it? Check your spam folder.
        </p>
      </div>
    </div>
  );
}
