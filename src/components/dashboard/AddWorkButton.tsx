"use client";

import { useRouter } from "next/navigation";
import { AddAvailableWorkModal } from "@/components/profile/AddAvailableWorkModal";
import type { Artwork } from "@/types/database";

export function AddWorkButton({ profileId }: { profileId: string }) {
  const router = useRouter();

  function handleSuccess(_work: Artwork) {
    router.refresh();
  }

  return <AddAvailableWorkModal profileId={profileId} onSuccess={handleSuccess} />;
}
