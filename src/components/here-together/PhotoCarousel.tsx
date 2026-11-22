"use client";

import { useState } from "react";

const SLIDES = [
  { src: "/here-together/trust-2.jpg", alt: "A large open room with timber floors, exposed brick and steel columns, looking down its length" },
  { src: "/here-together/trust-3.jpg", alt: "The same room from the centre, with steel columns and a bank of windows at the far end" },
  { src: "/here-together/trust-1.jpg", alt: "The room from the corner, with brick walls and windows along one side" },
];

export function PhotoCarousel() {
  const [i, setI] = useState(0);
  const go = (n: number) => setI((n + SLIDES.length) % SLIDES.length);
  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos of the space"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      <div className="ht-shot" style={{ aspectRatio: "3 / 2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={SLIDES[i].src} src={SLIDES[i].src} alt={SLIDES[i].alt} className="ht-fade h-full w-full object-cover" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-2">
          {SLIDES.map((s, n) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Show photo ${n + 1}`}
              aria-current={n === i}
              className={`h-12 w-[4.5rem] overflow-hidden transition-opacity ${n === i ? "opacity-100" : "opacity-40 hover:opacity-80"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => go(i - 1)} aria-label="Previous photo" className="ht-pebble">←</button>
          <button type="button" onClick={() => go(i + 1)} aria-label="Next photo" className="ht-pebble">→</button>
        </div>
      </div>
    </div>
  );
}
