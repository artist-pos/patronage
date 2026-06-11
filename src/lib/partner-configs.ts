export type TierDef = {
  name: string;
  area: string;
  artistFee: number;
  materials: number;
};

export type PartnerConfig = {
  slug: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Full Supabase Storage public URL for the proposal PDF */
  pdfUrl: string;
  tiers: TierDef[];
};

// Management fee is always 20% of artistFee.
// Per-box total = artistFee + materials + Math.round(artistFee * 0.2)
export const PARTNER_CONFIGS: Record<string, PartnerConfig> = {
  WEL: {
    slug: "WEL",
    eyebrow: "Patronage × WEL Networks",
    title: "Activating network assets through commissioned artwork.",
    subtitle:
      "Commissioned artwork across WEL's street-level assets. Coated, reported on, and managed end-to-end by Patronage.",
    pdfUrl: "https://vftehndhobjecumphupx.supabase.co/storage/v1/object/public/partner-proposals/WEL%20x%20Patronage.pdf",
    tiers: [
      { name: "Small",  area: "≤1.7 m²",     artistFee: 900,  materials: 130 },
      { name: "Medium", area: "1.8–2.9 m²",   artistFee: 1500, materials: 170 },
      { name: "Large",  area: "3–6 m²",        artistFee: 2000, materials: 370 },
      { name: "XL",     area: "6–9 m²",        artistFee: 2700, materials: 560 },
    ],
  },
};
