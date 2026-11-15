"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation } from "@/app/messages/actions";

/** For anyone who'd rather not reply in public: opens a message to the poster. */
export function MessagePosterButton({ posterId, label }: { posterId: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setError(null);
    startTransition(async () => {
      const res = await getOrCreateConversation(posterId);
      if ("error" in res) {
        if (res.error === "not_authenticated") router.push("/auth/login");
        else setError("Messaging isn't available for this account.");
        return;
      }
      router.push(`/messages/${res.id}`);
    });
  }

  return (
    <div className="mt-5">
      <button type="button" onClick={open} disabled={pending} className="btn btn-outline btn-sm">
        {pending ? "Opening…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-[13px] text-[color:var(--fg-muted)]">{error}</p>}
    </div>
  );
}
