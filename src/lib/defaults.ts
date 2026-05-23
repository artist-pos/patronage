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

// Avatar: 6 rich, jewel-toned gradient pairs
const AVATAR_GRADIENTS = [
  { from: "#c07850", to: "#7a3c1e" },   // terracotta
  { from: "#7268cc", to: "#3a2888" },   // indigo
  { from: "#52a882", to: "#286050" },   // teal
  { from: "#c07088", to: "#783050" },   // rose
  { from: "#c88c40", to: "#845010" },   // amber
  { from: "#6080a8", to: "#304868" },   // slate
] as const;

// Banner: 6 atmospheric, gallery-like gradients
const BANNER_GRADIENTS = [
  "linear-gradient(135deg, #f2e8d4 0%, #dcc8a8 100%)",   // warm parchment
  "linear-gradient(135deg, #d4e4e0 0%, #a0c0bc 100%)",   // seafoam
  "linear-gradient(135deg, #e4d8e4 0%, #bca0bc 100%)",   // lavender
  "linear-gradient(135deg, #d0d8e8 0%, #98b0c8 100%)",   // steel blue
  "linear-gradient(135deg, #ece0d4 0%, #ccb090 100%)",   // sand
  "linear-gradient(135deg, #d4e0d4 0%, #9cbc9c 100%)",   // sage
] as const;

export function getAvatarGradient(seed: string): { from: string; to: string } {
  return AVATAR_GRADIENTS[hashSeed(seed) % AVATAR_GRADIENTS.length];
}

export function getBannerGradient(seed: string): string {
  return BANNER_GRADIENTS[hashSeed(seed) % BANNER_GRADIENTS.length];
}
