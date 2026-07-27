"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  featuredImageUrl: string;
  secondaryImageUrl: string | null;
}

export function OpportunityHeroImage({ title, featuredImageUrl, secondaryImageUrl }: Props) {
  const [showSecondary, setShowSecondary] = useState(false);
  const src = showSecondary && secondaryImageUrl ? secondaryImageUrl : featuredImageUrl;

  return (
    <div className="relative mb-6 w-full overflow-hidden bg-white">
      <Image
        src={src}
        alt={title}
        width={1200}
        height={630}
        priority
        className="w-full h-auto max-h-[420px] object-contain"
      />
      {secondaryImageUrl && !showSecondary && (
        <button
          type="button"
          onClick={() => setShowSecondary(true)}
          aria-label="Show second image"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      {secondaryImageUrl && showSecondary && (
        <button
          type="button"
          onClick={() => setShowSecondary(false)}
          aria-label="Back to main image"
          className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
