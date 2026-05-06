import Link from "next/link";
import type { CompletionField } from "@/lib/profile-completion";

interface Props {
  percent: number;
  missingFields: CompletionField[];
}

export function ProfileCompletionBanner({ percent, missingFields }: Props) {
  if (percent === 100) return null;

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
    </div>
  );
}
