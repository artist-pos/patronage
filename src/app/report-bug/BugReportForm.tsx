"use client";

import { useActionState, useEffect, useState } from "react";
import { reportBugAction, type ReportBugState } from "./actions";
import { AREAS } from "./areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ReportBugState = { status: "idle" };

export function BugReportForm() {
  const [state, action, isPending] = useActionState(reportBugAction, initial);
  const [pageUrl, setPageUrl] = useState("");

  // Capture where the reporter came from, to help us reproduce.
  useEffect(() => {
    setPageUrl(document.referrer || "");
  }, []);

  if (state.status === "success") {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
        <p className="text-sm font-medium text-stone-900">Thanks — report received.</p>
        <p className="mt-1 text-sm text-stone-500">
          We read every one. If we need more detail we&rsquo;ll be in touch.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="pageUrl" value={pageUrl} />

      <div className="space-y-1.5">
        <Label htmlFor="area">Where did it happen?</Label>
        <select
          id="area"
          name="area"
          defaultValue=""
          required
          className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          <option value="" disabled>
            Choose an area…
          </option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Your email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          required
          autoComplete="email"
        />
        <p className="text-xs text-stone-400">
          So we can follow up. If you&rsquo;re signed in we&rsquo;ll use your account email.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">What went wrong?</Label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="What were you trying to do, what happened, and what did you expect instead?"
          className="border-input w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
      </div>

      {state.status === "error" && (
        <p className="text-sm text-destructive">{state.message}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}
