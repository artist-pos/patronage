// Deterministic default visuals for artist profiles.
// Picks from a curated set based on a simple string hash so the same
// username always gets the same gradient — no randomness per render.

function hashSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Avatar: light-to-dark pairs from the brand palette — dark enough for white initials
const AVATAR_GRADIENTS = [
  { from: "#E8E3DA", to: "#5C5852" },
  { from: "#C9C4BC", to: "#2A2724" },
  { from: "#B5A998", to: "#5C5852" },
  { from: "#E8E3DA", to: "#2A2724" },
  { from: "#9A958E", to: "#2A2724" },
  { from: "#C9C4BC", to: "#5C5852" },
] as const;

// Banner: subtle light-to-mid washes from the same palette
const BANNER_GRADIENTS = [
  "linear-gradient(135deg, #E8E3DA 0%, #C9C4BC 100%)",
  "linear-gradient(135deg, #E8E3DA 0%, #B5A998 100%)",
  "linear-gradient(135deg, #C9C4BC 0%, #9A958E 100%)",
  "linear-gradient(135deg, #E8E3DA 0%, #9A958E 100%)",
  "linear-gradient(135deg, #C9C4BC 0%, #B5A998 100%)",
  "linear-gradient(135deg, #E8E3DA 0%, #5C5852 100%)",
] as const;

export function getAvatarGradient(seed: string): { from: string; to: string } {
  return AVATAR_GRADIENTS[hashSeed(seed) % AVATAR_GRADIENTS.length];
}

export function getBannerGradient(seed: string): string {
  return BANNER_GRADIENTS[hashSeed(seed) % BANNER_GRADIENTS.length];
}
