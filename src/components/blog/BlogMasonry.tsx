"use client";

import { Children, useEffect, useState } from "react";

interface Props {
  children: React.ReactNode;
}

// Round-robin column distribution — items alternate left/right so reading
// order stays roughly chronological. CSS `columns` fills top-to-bottom per
// column (and breaks on iOS Safari inside flex containers), so columns are
// assigned manually, matching the feed masonry pattern.
export function BlogMasonry({ children }: Props) {
  const [cols, setCols] = useState(2);

  useEffect(() => {
    function update() {
      setCols(window.innerWidth >= 640 ? 2 : 1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const items = Children.toArray(children);

  return (
    <div className="flex items-start gap-6 sm:gap-8">
      {Array.from({ length: cols }, (_, col) => (
        <div key={col} className="flex min-w-0 flex-1 flex-col gap-6 sm:gap-8">
          {items.filter((_, i) => i % cols === col)}
        </div>
      ))}
    </div>
  );
}
