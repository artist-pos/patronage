"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { initializeInquiryThread } from "@/app/messages/actions";

interface Props {
  otherUserId: string;
  label?: string;
  /** "solid" = black CTA (commissions Enquire block) */
  variant?: "default" | "solid";
}

export function MessageButton({ otherUserId, label = "Message", variant = "default" }: Props) {
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
      className={
        variant === "solid"
          ? "inline-flex h-9 items-center bg-foreground text-background px-5 text-[13px] font-medium hover:opacity-85 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          : "inline-flex h-9 items-center bg-white text-gray-700 border border-gray-300 px-5 text-[13px] font-medium hover:border-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      }
    >
      {isPending ? "…" : label}
    </button>
  );
}
