"use client";

import { getFontPair, type ProvenanceFontPair, type ProvenanceOrientation } from "@/lib/provenance-theme";

interface CertificatePreviewProps {
  logoUrl: string | null;
  signatureUrl: string | null;
  theme: "minimal" | "editorial" | "gallery";
  primaryColor: string;
  accentColor: string;
  fontPair: ProvenanceFontPair;
  orientation: ProvenanceOrientation;
}

function QrPlaceholder({ size = 36 }: { size?: number }) {
  const px = `${size}px`;
  const cell = size / 9;
  return (
    <div
      className="flex-shrink-0 bg-stone-100 rounded overflow-hidden flex items-center justify-center"
      style={{ width: px, height: px }}
    >
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" aria-hidden>
        <rect x="0" y="0" width="14" height="14" rx="1" fill="#9CA3AF" />
        <rect x="4" y="4" width="6" height="6" fill="white" />
        <rect x="22" y="0" width="14" height="14" rx="1" fill="#9CA3AF" />
        <rect x="26" y="4" width="6" height="6" fill="white" />
        <rect x="0" y="22" width="14" height="14" rx="1" fill="#9CA3AF" />
        <rect x="4" y="26" width="6" height="6" fill="white" />
        <rect x="16" y="16" width={cell} height={cell} fill="#9CA3AF" />
        <rect x="22" y="16" width={cell} height={cell} fill="#9CA3AF" />
        <rect x="16" y="22" width={cell} height={cell} fill="#9CA3AF" />
        <rect x="22" y="22" width={cell} height={cell} fill="#9CA3AF" />
        <rect x="28" y="22" width={cell} height={cell} fill="#9CA3AF" />
        <rect x="16" y="28" width={cell} height={cell} fill="#9CA3AF" />
        <rect x="28" y="28" width={cell} height={cell} fill="#9CA3AF" />
      </svg>
    </div>
  );
}

function Auto({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-dashed border-stone-300 rounded px-1">
      {children}
    </span>
  );
}

function LogoSlot({ logoUrl, fallbackBg }: { logoUrl: string | null; fallbackBg: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="Studio logo" className="h-5 max-w-[80px] object-contain" />;
  }
  return <div className="h-4 w-16 rounded" style={{ background: fallbackBg }} />;
}

function SignatureSlot({ signatureUrl, fallbackBg }: { signatureUrl: string | null; fallbackBg: string }) {
  if (signatureUrl) {
    return <img src={signatureUrl} alt="Artist signature" className="h-7 max-w-[110px] object-contain" />;
  }
  return <div className="h-6 w-20 rounded" style={{ background: fallbackBg }} />;
}

// Page 1 thumbnail: header, image, details, statement, signature, QR.
// Page 2 thumbnail: chain of custody, legal, QR, footer.
// Both thumbnails respond to primary/accent colour and font pair.
export function CertificatePreview({
  logoUrl,
  signatureUrl,
  theme,
  primaryColor,
  accentColor,
  fontPair,
  orientation,
}: CertificatePreviewProps) {
  const pair = getFontPair(fontPair);
  const headingStyle: React.CSSProperties = {
    fontFamily: pair.cssHeadingStack,
    fontWeight: pair.cssHeadingWeight,
  };
  const bodyStyle: React.CSSProperties = { fontFamily: pair.cssBodyStack };

  const aspectClass = orientation === "landscape" ? "aspect-[1.414/1]" : "aspect-[1/1.414]";
  const imageAspect = orientation === "landscape" ? "aspect-[2.5/1]" : "aspect-[16/9]";

  const tone =
    theme === "editorial"
      ? { bg: "bg-amber-50", border: "border-amber-200", chipBg: "bg-amber-100" }
      : theme === "gallery"
        ? { bg: "bg-white", border: "border-stone-300", chipBg: "bg-stone-200" }
        : { bg: "bg-white", border: "border-stone-200", chipBg: "bg-stone-100" };

  return (
    <div className="flex flex-col gap-3">
      {/* Page 1 */}
      <div
        className={`relative ${aspectClass} ${tone.bg} border ${tone.border} rounded-xl overflow-hidden shadow-sm text-[10px] leading-snug flex flex-col`}
        style={bodyStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <LogoSlot logoUrl={logoUrl} fallbackBg={tone.chipBg.includes("amber") ? "#FEF3C7" : "#F1F1F0"} />
          <div className="text-right">
            <p className="font-mono text-[8px]" style={{ color: accentColor }}>LEDGER ID</p>
            <p className="font-mono text-[9px]" style={{ color: primaryColor }}>PTRN-2026-XXXX-XXXX</p>
          </div>
        </div>

        <p className="px-4 text-[11px] tracking-[0.18em] mb-2" style={{ ...headingStyle, color: primaryColor }}>
          CERTIFICATE OF PROVENANCE
        </p>
        <div className="mx-4 mb-3 border-b" style={{ borderColor: primaryColor }} />

        {/* Image */}
        <div className={`mx-4 mb-3 ${imageAspect} bg-stone-100 rounded border-2 border-dashed border-stone-200 flex items-center justify-center text-[9px] text-stone-400`}>
          Artwork image
        </div>

        {/* Details */}
        <div className="px-4 space-y-1.5 mb-3">
          <Row label="WORK" labelColor={accentColor} headingStyle={headingStyle} valueColor={primaryColor}>
            <Auto>Untitled Work</Auto>
          </Row>
          <Row label="ARTIST" labelColor={accentColor} headingStyle={headingStyle} valueColor={primaryColor}>
            <Auto>Artist Name</Auto>
          </Row>
          <Row label="TRANSFER" labelColor={accentColor} headingStyle={headingStyle} valueColor={primaryColor}>
            <Auto>Artist → Collector</Auto>
          </Row>
        </div>

        {/* Statement */}
        <div className="mx-4 mb-3 pl-3 border-l-2" style={{ borderColor: primaryColor }}>
          <p className="text-[9px] italic" style={{ color: "#555", ...bodyStyle }}>
            <Auto>Your per-artwork statement appears here.</Auto>
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between px-4 pb-3 pt-2">
          <div>
            <SignatureSlot signatureUrl={signatureUrl} fallbackBg={tone.chipBg.includes("amber") ? "#FEF3C7" : "#F1F1F0"} />
            <p className="text-[7px] tracking-widest mt-1" style={{ ...headingStyle, color: accentColor, fontWeight: 600 }}>
              SIGNED BY THE ARTIST
            </p>
          </div>
          <div className="text-right">
            <div className="flex justify-end"><QrPlaceholder size={28} /></div>
            <p className="text-[7px] mt-1" style={{ color: accentColor }}>Scan to verify</p>
          </div>
        </div>
      </div>

      {/* Page 2 */}
      <div
        className={`relative ${aspectClass} ${tone.bg} border ${tone.border} rounded-xl overflow-hidden shadow-sm text-[10px] leading-snug flex flex-col`}
        style={bodyStyle}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <LogoSlot logoUrl={logoUrl} fallbackBg={tone.chipBg.includes("amber") ? "#FEF3C7" : "#F1F1F0"} />
          <div className="text-right">
            <p className="font-mono text-[8px]" style={{ color: accentColor }}>LEDGER ID</p>
            <p className="font-mono text-[9px]" style={{ color: primaryColor }}>PTRN-2026-XXXX-XXXX</p>
          </div>
        </div>
        <div className="mx-4 mb-3 border-b" style={{ borderColor: primaryColor }} />

        <p className="px-4 text-[8px] tracking-widest mb-2" style={{ ...headingStyle, color: accentColor, fontWeight: 700 }}>
          CHAIN OF CUSTODY
        </p>

        <div className="mx-4 border-l border-stone-200 pl-3 space-y-2 mb-2">
          <CustodyItem date="14 Mar 2026" event="Created & registered" detail="Registered to Artist Name" headingStyle={headingStyle} primaryColor={primaryColor} accentColor={accentColor} />
          <CustodyItem date="22 Apr 2026" event="Transferred"          detail="Artist → Collector"            headingStyle={headingStyle} primaryColor={primaryColor} accentColor={accentColor} />
        </div>

        <p className="px-4 text-[8px] mb-2" style={{ color: accentColor }}>
          This document certifies the transfer of ownership as recorded on the Patronage platform…
        </p>

        <div className="mt-auto px-4 pb-3">
          <div className="flex justify-end mb-2">
            <div className="text-right">
              <QrPlaceholder size={48} />
              <p className="text-[7px] mt-1" style={{ color: accentColor }}>Scan to verify provenance</p>
            </div>
          </div>
          <div className="border-t border-stone-200 pt-2">
            <p className="text-[7px] text-center" style={{ color: accentColor }}>
              Recorded on Patronage · patronage.nz · patronage.nz/provenance/PTRN-2026-XXXX-XXXX
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  labelColor,
  headingStyle,
  valueColor,
  children,
}: {
  label: string;
  labelColor: string;
  headingStyle: React.CSSProperties;
  valueColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <span
        className="text-[7px] tracking-widest pt-0.5 w-12 shrink-0"
        style={{ ...headingStyle, color: labelColor, fontWeight: 700 }}
      >
        {label}
      </span>
      <span className="text-[10px]" style={{ color: valueColor }}>
        {children}
      </span>
    </div>
  );
}

function CustodyItem({
  date,
  event,
  detail,
  headingStyle,
  primaryColor,
  accentColor,
}: {
  date: string;
  event: string;
  detail: string;
  headingStyle: React.CSSProperties;
  primaryColor: string;
  accentColor: string;
}) {
  return (
    <div>
      <p className="text-[8px]" style={{ color: accentColor }}>{date}</p>
      <p className="text-[10px]" style={{ ...headingStyle, color: primaryColor }}>{event}</p>
      <p className="text-[9px]" style={{ color: accentColor }}>{detail}</p>
    </div>
  );
}
