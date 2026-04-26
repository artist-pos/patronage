"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const ClaimModal = dynamic(
  () => import("./ClaimModal").then(m => ({ default: m.ClaimModal })),
  { ssr: false }
);

const CertificatePdfModal = dynamic(
  () => import("@/components/provenance/CertificatePdfModal").then(m => ({ default: m.CertificatePdfModal })),
  { ssr: false }
);

interface Props {
  ledgerId: string;
  artworkId: string;
  artworkTitle: string;
  isLoggedIn: boolean;
  isArtist: boolean;
  isCurrentOwner: boolean;
  artworkIsAvailable: boolean;
  artistUsername: string;
}

export function ProvenanceClient({
  ledgerId,
  artworkId,
  artworkTitle,
  isArtist,
  isCurrentOwner,
  artworkIsAvailable,
  artistUsername,
}: Props) {
  const [showClaim, setShowClaim] = useState(false);
  const [showCert, setShowCert] = useState(false);

  const certificateUrl = `/api/provenance/certificate?artworkId=${artworkId}`;

  return (
    <>
      {/* ── Conditional CTAs ── */}
      {isArtist ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-4">
            Artist actions
          </h2>
          <a
            href={`/dashboard?tab=provenance`}
            className="flex items-center justify-between w-full px-4 py-3.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm font-medium"
          >
            <span>Transfer ownership</span>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </a>
          <button
            type="button"
            onClick={() => setShowCert(true)}
            className="flex items-center justify-between w-full px-4 py-3.5 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm"
          >
            <span>View certificate</span>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </section>
      ) : isCurrentOwner ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-widest text-stone-400 mb-4">
            Your collection
          </h2>
          <button
            type="button"
            onClick={() => setShowCert(true)}
            className="flex items-center justify-between w-full px-4 py-3.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm font-medium"
          >
            <span>View certificate</span>
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="flex items-center justify-between w-full px-4 py-3.5 border border-stone-100 text-stone-400 rounded-lg text-sm cursor-not-allowed">
            <span>Resell this work</span>
            <span className="text-xs bg-stone-100 rounded-full px-2.5 py-0.5">Coming soon</span>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {artworkIsAvailable ? (
            <>
              <button
                onClick={() => setShowClaim(true)}
                className="flex items-center justify-between w-full px-4 py-3.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm font-medium"
              >
                <span>I own this work</span>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              <a
                href={`/${artistUsername}`}
                className="flex items-center justify-between w-full px-4 py-3.5 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm"
              >
                <span>Interested in this work?</span>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </a>
            </>
          ) : (
            <a
              href={`/${artistUsername}`}
              className="flex items-center justify-between w-full px-4 py-3.5 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors text-sm"
            >
              <span>Visit artist profile</span>
              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          )}
        </section>
      )}

      {showClaim && (
        <ClaimModal
          artworkId={artworkId}
          artworkTitle={artworkTitle}
          onClose={() => setShowClaim(false)}
        />
      )}

      {showCert && (
        <CertificatePdfModal
          pdfUrl={certificateUrl}
          filename={`provenance-${ledgerId}.pdf`}
          onClose={() => setShowCert(false)}
        />
      )}
    </>
  );
}
