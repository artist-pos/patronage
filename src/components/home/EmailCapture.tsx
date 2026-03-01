"use client";

import { useActionState } from "react";
import { subscribeAction, type SubscribeState } from "@/app/subscribe/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initial: SubscribeState = { status: "idle" };

export function EmailCapture() {
  const [state, action, isPending] = useActionState(subscribeAction, initial);

  if (state.status === "success") {
    return (
      <p className="text-sm text-muted-foreground">
        You&rsquo;re subscribed. We&rsquo;ll send the weekly digest to your inbox.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 flex flex-col items-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        Weekly digest
      </p>
      <p className="text-sm text-muted-foreground">
        New and closing-soon opportunities, delivered every week.
      </p>
      <div className="flex gap-2 w-full max-w-sm">
        <Input
          name="email"
          type="email"
          placeholder="your@email.com"
          required
          autoComplete="email"
          className="flex-1"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "…" : "Subscribe"}
        </Button>
      </div>
      {state.status === "error" && (
        <p className="text-xs text-destructive">{state.message}</p>
      )}
    </form>
  );
}
