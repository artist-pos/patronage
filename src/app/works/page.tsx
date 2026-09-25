import type { Metadata } from "next";
import { ExploreView, type ExploreParams } from "@/app/feed/ExploreView";

export const metadata: Metadata = {
  title: {
    absolute: "Original Art for Sale NZ | Paintings & Works by NZ Artists | Patronage",
  },
  description:
    "Browse and buy original artwork from New Zealand artists. Paintings, mixed media, sculpture and more. Every purchase supports the artist directly through Patronage.",
  alternates: { canonical: "https://patronage.nz/works" },
  openGraph: {
    title: "Original Art for Sale NZ | Patronage",
    description:
      "Browse and buy original artwork from New Zealand artists. Paintings, mixed media, sculpture and more — every purchase supports the artist directly.",
    type: "website",
  },
};

interface PageProps {
  searchParams: Promise<ExploreParams>;
}

// Explore's "For sale" tab, at its own URL so it keeps its title and search
// presence. Same page as /feed; the tab row switches between the two.
export default async function WorksPage({ searchParams }: PageProps) {
  return <ExploreView tab="works" params={await searchParams} />;
}
