"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOrCreateConversation, sendMessage } from "@/app/messages/actions";

interface Props {
  artistId: string;
  artistName: string;
  workTitle: string | null;
}

export function EnquireButton({ artistId, artistName, workTitle }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await getOrCreateConversation(artistId);
      if ("error" in result) return;

      const body = workTitle
        ? `Hi ${artistName}, I'm interested in "${workTitle}".`
        : `Hi ${artistName}, I'm interested in your work.`;

      await sendMessage(result.id, body);
      router.push(`/messages/${result.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full bg-black text-white text-xs py-1.5 px-3 hover:opacity-80 transition-opacity disabled:opacity-40"
    >
      {loading ? "Opening…" : "Enquire to Buy"}
    </button>
  );
}
