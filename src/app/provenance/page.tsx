import { ProvenanceLookup } from "./ProvenanceLookup";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify provenance | Patronage",
  description: "Verify a Patronage provenance record by scanning the QR code or entering the ledger ID.",
};

export default function ProvenanceLandingPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="max-w-md mx-auto px-4 py-16 md:py-24">
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-6">
            <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-emerald-700">Patronage provenance ledger</span>
          </div>
          <h1 className="text-3xl font-semibold text-stone-900 mb-2">Verify provenance</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Scan the QR code on a certificate, or enter the ledger ID printed at the top of it.
          </p>
        </div>

        <ProvenanceLookup />

        <p className="text-xs text-stone-400 mt-12 leading-relaxed">
          Patronage provenance certificates record an artwork’s creation and
          every subsequent transfer of ownership. Each certificate carries a
          unique ledger ID in the format <span className="font-mono">PTRN-YYYY-XXXX-XXXX</span>.
        </p>
      </div>
    </main>
  );
}
