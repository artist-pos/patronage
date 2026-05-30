import Link from "next/link";

export function ForYouTeaser() {
  return (
    <div className="border border-border p-12 text-center space-y-4">
      <p className="text-base font-semibold tracking-tight">
        See opportunities matched to your practice
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
        We score every open opportunity against your disciplines, location, and career stage — so the most relevant ones rise to the top.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <Link
          href="/get-started"
          className="inline-block text-sm font-medium px-6 py-2.5 bg-black text-white hover:opacity-80 transition-opacity"
        >
          Get matched — it&apos;s free
        </Link>
        <Link
          href="/auth/login"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Already have an account?
        </Link>
      </div>
    </div>
  );
}
