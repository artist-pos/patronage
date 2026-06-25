import type { Metadata } from "next";
import { BugReportForm } from "./BugReportForm";

export const metadata: Metadata = {
  title: "Report a bug — Patronage",
  description: "Found something broken on Patronage? Let us know and we'll fix it.",
};

export default function ReportBugPage() {
  return (
    <main className="max-w-[1600px] mx-auto px-6 py-16">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
          Report a bug
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
          Something not working?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-stone-500">
          Tell us what happened and we&rsquo;ll get it sorted. The more detail the
          better — what you were doing, what you expected, and what you saw instead.
        </p>

        <div className="mt-8">
          <BugReportForm />
        </div>
      </div>
    </main>
  );
}
