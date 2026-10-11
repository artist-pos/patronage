import Link from "next/link";
import type { CompletionField } from "@/lib/profile-completion";
import { VERIFIED_WORKS_REQUIRED, type VerifiedProgress } from "@/lib/verified-progress";

interface Props {
  percent: number;
  missingFields: CompletionField[];
  /** When given, the banner also tracks the Verified rule (bio, photo, 3 works). */
  verified?: VerifiedProgress;
}

export function ProfileCompletionBanner({ percent, missingFields, verified }: Props) {
  const profileDone = percent === 100;
  const verifiedDone = !verified || verified.verified;
  if (profileDone && verifiedDone) return null;

  // Profile basics done, but not Verified yet: a short, specific nudge.
  if (profileDone && verified) {
    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 space-y-1 mb-6">
        <p className="text-sm font-medium text-amber-900">
          {verified.worksCount} of {VERIFIED_WORKS_REQUIRED} works added
        </p>
        <p className="text-xs text-amber-800">
          Add{" "}
          <Link href="/studio/works" className="underline underline-offset-2 hover:text-amber-950 transition-colors">
            {verified.worksNeeded} more work{verified.worksNeeded === 1 ? "" : "s"}
          </Link>{" "}
          to become Verified. Verified artists can sell work and accept support.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-3 space-y-2.5 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-amber-900">
          Profile {percent}% complete
        </p>
        <span className="text-xs text-amber-700">
          {missingFields.length} item{missingFields.length !== 1 ? "s" : ""} remaining
        </span>
      </div>

      <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {missingFields.map((f) => (
          <Link
            key={f.key}
            href={f.href}
            className="text-xs text-amber-800 underline underline-offset-2 hover:text-amber-950 transition-colors"
          >
            Add {f.label}
          </Link>
        ))}
      </div>

      {verified && !verified.verified && (
        <p className="text-xs text-amber-800">
          Verified also needs {VERIFIED_WORKS_REQUIRED} works ({verified.worksCount} added). Verified artists can sell
          work and accept support.
        </p>
      )}
    </div>
  );
}
