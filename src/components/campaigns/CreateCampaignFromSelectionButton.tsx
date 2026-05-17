"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCampaignFromSelection } from "@/app/studio/campaigns/actions";

interface Props {
  applicationId: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityType: string;
}

export function CreateCampaignFromSelectionButton({
  applicationId,
  opportunityId,
  opportunityTitle,
  opportunityType,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    setLoading(true);
    setError(null);
    startTransition(async () => {
      const result = await createCampaignFromSelection({
        applicationId,
        opportunityId,
        opportunityTitle,
        opportunityType,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else if (result.campaignId) {
        router.push(`/studio/campaigns/${result.campaignId}`);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="text-sm border border-black px-4 py-2 hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create campaign"}
      </button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
