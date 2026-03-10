"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initializeInquiryThread } from "@/app/messages/actions";

interface Props {
  artistId: string;
  artistName: string;
  workId?: string | null;
  workTitle: string | null;
  workDescription?: string | null;
}

export function EnquireButton({ artistId, workId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await initializeInquiryThread(
        artistId,
        "artwork_enquiry",
        workId ?? null
      );
      if ("error" in result) {
        if (result.error === "not_authenticated") router.push("/auth/login");
        return;
      }
      router.push(`/messages/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full border border-black text-xs py-1.5 px-3 hover:bg-muted/40 transition-colors disabled:opacity-40"
    >
      {loading ? "Opening…" : "Enquire"}
    </button>
  );
}
