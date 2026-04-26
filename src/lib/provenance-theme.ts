// Shared provenance theme model — used by the PDF generator (react-pdf with its
// built-in fonts) and the in-app preview (CSS font stacks). Keep these two
// shapes in lock-step so the preview is an honest representation of the PDF.

export type ProvenanceTemplateTheme = "minimal" | "editorial" | "gallery";
export type ProvenanceFontPair =
  | "classic" | "modern" | "mixed" | "inverse"
  | "editorial" | "mono" | "condensed" | "display";
export type ProvenanceOrientation = "portrait" | "landscape";

export interface ProvenanceTheme {
  template: ProvenanceTemplateTheme;
  primaryColor: string;
  accentColor: string;
  fontPair: ProvenanceFontPair;
  orientation: ProvenanceOrientation;
}

export const DEFAULT_THEME: ProvenanceTheme = {
  template: "minimal",
  primaryColor: "#000000",
  accentColor: "#888888",
  fontPair: "classic",
  orientation: "portrait",
};

export interface FontPairSpec {
  id: ProvenanceFontPair;
  label: string;
  description: string;
  // PDF-side fonts: must be one of @react-pdf/renderer's built-in fonts
  // (Helvetica*, Times-*, Courier*) unless we ship custom font registration.
  pdfHeadingFamily: string;
  pdfBodyFamily: string;
  // CSS fallback stacks for the live preview.
  cssHeadingStack: string;
  cssBodyStack: string;
  // Heading weight cue for preview rendering only.
  cssHeadingWeight: number;
}

export const FONT_PAIRS: FontPairSpec[] = [
  {
    id: "classic",
    label: "Classic",
    description: "Serif heading & body — the traditional certificate look.",
    pdfHeadingFamily: "Times-Bold",
    pdfBodyFamily: "Times-Roman",
    cssHeadingStack: 'Georgia, "Times New Roman", serif',
    cssBodyStack: 'Georgia, "Times New Roman", serif',
    cssHeadingWeight: 700,
  },
  {
    id: "modern",
    label: "Modern",
    description: "Clean sans-serif throughout.",
    pdfHeadingFamily: "Helvetica-Bold",
    pdfBodyFamily: "Helvetica",
    cssHeadingStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssBodyStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssHeadingWeight: 600,
  },
  {
    id: "mixed",
    label: "Mixed",
    description: "Serif heading paired with a sans-serif body.",
    pdfHeadingFamily: "Times-Bold",
    pdfBodyFamily: "Helvetica",
    cssHeadingStack: 'Georgia, "Times New Roman", serif',
    cssBodyStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssHeadingWeight: 700,
  },
  {
    id: "inverse",
    label: "Inverse",
    description: "Sans heading over a serif body — editorial flip.",
    pdfHeadingFamily: "Helvetica-Bold",
    pdfBodyFamily: "Times-Roman",
    cssHeadingStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssBodyStack: 'Georgia, "Times New Roman", serif',
    cssHeadingWeight: 700,
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Bold serif heading and italic serif body.",
    pdfHeadingFamily: "Times-Bold",
    pdfBodyFamily: "Times-Italic",
    cssHeadingStack: 'Georgia, "Times New Roman", serif',
    cssBodyStack: 'Georgia, "Times New Roman", serif',
    cssHeadingWeight: 800,
  },
  {
    id: "mono",
    label: "Mono",
    description: "Monospace heading with a sans body — technical feel.",
    pdfHeadingFamily: "Courier-Bold",
    pdfBodyFamily: "Helvetica",
    cssHeadingStack: '"SF Mono", ui-monospace, Menlo, Consolas, monospace',
    cssBodyStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssHeadingWeight: 700,
  },
  {
    id: "condensed",
    label: "Condensed",
    description: "Tight, all-caps sans heading on a sans body.",
    pdfHeadingFamily: "Helvetica-Bold",
    pdfBodyFamily: "Helvetica",
    cssHeadingStack: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    cssBodyStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssHeadingWeight: 800,
  },
  {
    id: "display",
    label: "Display",
    description: "Statement serif heading on a clean sans body.",
    pdfHeadingFamily: "Times-Bold",
    pdfBodyFamily: "Helvetica",
    cssHeadingStack: 'Georgia, "Times New Roman", serif',
    cssBodyStack: 'system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif',
    cssHeadingWeight: 700,
  },
];

export function getFontPair(id: ProvenanceFontPair): FontPairSpec {
  return FONT_PAIRS.find(f => f.id === id) ?? FONT_PAIRS[0];
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normaliseColor(input: string | null | undefined, fallback: string): string {
  if (!input) return fallback;
  return HEX_RE.test(input.trim()) ? input.trim() : fallback;
}

export function resolveTheme(profile: {
  provenance_template_theme?: string | null;
  provenance_primary_color?: string | null;
  provenance_accent_color?: string | null;
  provenance_font_pair?: string | null;
  provenance_orientation?: string | null;
} | null | undefined): ProvenanceTheme {
  const template = (["minimal", "editorial", "gallery"] as const).includes(
    (profile?.provenance_template_theme as ProvenanceTemplateTheme) ?? "minimal" as never,
  )
    ? (profile!.provenance_template_theme as ProvenanceTemplateTheme)
    : DEFAULT_THEME.template;
  const fontPair = FONT_PAIRS.some(f => f.id === profile?.provenance_font_pair)
    ? (profile!.provenance_font_pair as ProvenanceFontPair)
    : DEFAULT_THEME.fontPair;
  const orientation: ProvenanceOrientation =
    profile?.provenance_orientation === "landscape" ? "landscape" : "portrait";

  return {
    template,
    primaryColor: normaliseColor(profile?.provenance_primary_color, DEFAULT_THEME.primaryColor),
    accentColor: normaliseColor(profile?.provenance_accent_color, DEFAULT_THEME.accentColor),
    fontPair,
    orientation,
  };
}
