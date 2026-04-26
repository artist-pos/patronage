"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const LEDGER_PATTERN = /PTRN-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}/i;
const SCANNER_DIV_ID = "provenance-qr-scanner";

type ScanState = "idle" | "starting" | "scanning" | "error";

export function ProvenanceLookup() {
  const router = useRouter();
  const [ledgerInput, setLedgerInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  function navigateToLedger(rawId: string): boolean {
    const id = rawId.trim().toUpperCase();
    const formatted = id.match(LEDGER_PATTERN)?.[0]?.toUpperCase();
    if (!formatted) {
      setInputError("That doesn’t look like a Patronage ledger ID.");
      return false;
    }
    setInputError(null);
    router.push(`/provenance/${formatted}`);
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateToLedger(ledgerInput);
  }

  async function startScan() {
    setScanState("starting");
    setScanError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(SCANNER_DIV_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => {
          // The QR encodes a full provenance URL — extract the ledger ID.
          scanner.stop().catch(() => {});
          scannerRef.current = null;
          setScanState("idle");
          const match = decoded.match(LEDGER_PATTERN)?.[0]?.toUpperCase();
          if (match) {
            router.push(`/provenance/${match}`);
          } else {
            setScanError("That QR code didn’t look like a Patronage certificate.");
          }
        },
        () => {} // per-frame errors are normal
      );
      setScanState("scanning");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setScanState("error");
      setScanError(
        msg.toLowerCase().includes("permission")
          ? "Camera access was denied. Allow camera access and try again."
          : "Couldn’t start the camera. Try entering the ledger ID instead."
      );
      scannerRef.current = null;
    }
  }

  async function stopScan() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanState("idle");
  }

  useEffect(() => () => {
    if (scannerRef.current) scannerRef.current.stop().catch(() => {});
  }, []);

  // OCR fallback: lazy-load Tesseract.js when the user taps the camera icon
  // beside the text field. This points the device camera at printed text on
  // the certificate and reads the ledger ID into the field.
  async function handleOcrFile(file: File) {
    setOcrError(null);
    setOcrBusy(true);
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "eng");
      const match = data.text.match(LEDGER_PATTERN)?.[0]?.toUpperCase();
      if (match) {
        setLedgerInput(match);
        setInputError(null);
        // Auto-navigate when we got a clean read
        router.push(`/provenance/${match}`);
      } else {
        setOcrError("Couldn’t read a ledger ID from that image. Try again or type it in.");
      }
    } catch (err) {
      console.error(err);
      setOcrError("Text recognition failed. Try again or type the ID.");
    } finally {
      setOcrBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Scanner viewport — only visible while scanning */}
      <div
        id={SCANNER_DIV_ID}
        className={`rounded-xl overflow-hidden bg-stone-900 ${scanState === "scanning" ? "block" : "hidden"}`}
        style={{ minHeight: scanState === "scanning" ? 280 : 0 }}
      />

      {/* Primary action: scan QR */}
      {scanState === "scanning" ? (
        <button
          type="button"
          onClick={stopScan}
          className="flex items-center justify-center gap-2 w-full px-4 py-3.5 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Stop camera
        </button>
      ) : (
        <button
          type="button"
          onClick={startScan}
          disabled={scanState === "starting"}
          className="flex items-center justify-center gap-2 w-full px-4 py-3.5 bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors text-sm font-medium disabled:opacity-60"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
          </svg>
          {scanState === "starting" ? "Starting camera…" : "Scan QR code"}
        </button>
      )}
      {scanError && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{scanError}</p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-[11px] uppercase tracking-widest text-stone-400">or enter ID</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      {/* Manual lookup with OCR camera fallback */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative flex">
          <input
            type="text"
            value={ledgerInput}
            onChange={e => { setLedgerInput(e.target.value); setInputError(null); }}
            placeholder="PTRN-2026-XXXX-XXXX"
            spellCheck={false}
            autoCapitalize="characters"
            inputMode="text"
            className={`flex-1 h-12 px-3 pr-12 rounded-lg border text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-stone-900 ${
              inputError ? "border-red-300" : "border-stone-200"
            }`}
          />
          <button
            type="button"
            onClick={() => ocrInputRef.current?.click()}
            disabled={ocrBusy}
            aria-label="Scan ledger ID with camera"
            className="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 flex items-center justify-center rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-50"
            title="Scan printed ledger ID with camera"
          >
            {ocrBusy ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l1.5-2.25h7.5l1.5 2.25H21a.75.75 0 01.75.75V18a.75.75 0 01-.75.75H3A.75.75 0 012.25 18V8.25A.75.75 0 013 7.5h3.75z" />
                <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth={1.6} />
              </svg>
            )}
          </button>
          {/* Hidden capture input — Safari/Chrome on mobile open the back camera
              directly when capture="environment" is set. On desktop it falls
              back to a file picker, so users can upload a photo of the
              certificate too. */}
          <input
            ref={ocrInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleOcrFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {inputError && <p className="text-xs text-red-600">{inputError}</p>}
        {ocrError && <p className="text-xs text-red-600">{ocrError}</p>}

        <button
          type="submit"
          disabled={!ledgerInput.trim()}
          className="w-full h-11 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Verify provenance
        </button>
        <p className="text-[11px] text-stone-400 text-center pt-1">
          Tip: tap the camera icon to scan the printed ID instead of typing it.
        </p>
      </form>
    </div>
  );
}
