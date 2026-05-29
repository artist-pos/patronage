"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ClaimTokensTable } from "./ClaimTokensTable";
import { GenerateTokenModal } from "./GenerateTokenModal";
import type { EnrichedClaimToken } from "./actions";

interface Props {
  initialTokens: EnrichedClaimToken[];
}

export function ClaimTokensClient({ initialTokens }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 text-xs font-medium px-4 py-2.5 bg-black text-white hover:opacity-80 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" />
          Generate Token
        </button>
      </div>

      <ClaimTokensTable tokens={initialTokens} />

      {showModal && (
        <GenerateTokenModal
          onClose={() => setShowModal(false)}
          onGenerated={() => { setShowModal(false); window.location.reload(); }}
        />
      )}
    </div>
  );
}
