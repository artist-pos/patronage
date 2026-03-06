"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { initializeInquiryThread } from "@/app/messages/actions";

interface Props {
  otherUserId: string;
}

export function MessageButton({ otherUserId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await initializeInquiryThread(otherUserId, "profile_enquiry");
      if ("error" in result) {
        if (result.error === "not_authenticated") router.push("/auth/login");
        return;
      }
      router.push(`/messages/${result.id}`);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="bg-white text-black border border-black px-4 py-1.5 text-xs hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "…" : "Message"}
    </button>
  );
}
