"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation } from "@/app/messages/actions";
import { Button } from "@/components/ui/button";

interface Props {
  otherUserId: string;
}

export function MessageButton({ otherUserId }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await getOrCreateConversation(otherUserId);
      if ("error" in result) {
        if (result.error === "not_authenticated") {
          router.push("/auth/login");
        }
        return;
      }
      router.push(`/messages/${result.id}`);
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant="outline"
      className="border-black"
    >
      {isPending ? "…" : "Message"}
    </Button>
  );
}
