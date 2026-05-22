import Link from "next/link";

export const metadata = { title: "Join Patronage" };

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

export default function GetStartedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">How will you use Patronage?</h1>
          <p className="text-sm text-muted-foreground">
            Choose your role to get started.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {roles.map(({ value, label, description }) => (
            <Link
              key={value}
              href={`/auth/signup?role=${value}`}
              className="block text-left border border-black p-6 space-y-2 hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black"
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
