import Link from "next/link";
import { Lock } from "lucide-react";
import type { CompletionField } from "@/lib/profile-completion";

interface Props {
  featureName: string;
  missingFields: CompletionField[];
  message?: string;
}

export function SectionLockGate({ featureName, missingFields, message }: Props) {
  return (
    <div className="border border-dashed border-stone-300 rounded-lg p-8 flex flex-col items-center text-center gap-3">
      <Lock className="w-5 h-5 text-muted-foreground" />
      <div className="space-y-1.5 max-w-sm">
        <p className="text-sm font-medium">
          {message ?? `Complete your profile to unlock ${featureName}.`}
        </p>
        <p className="text-sm text-muted-foreground">
          Add:{" "}
          {missingFields.map((f, i) => (
            <span key={f.key}>
              {i > 0 && ", "}
              <Link
                href={f.href}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {f.label}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
