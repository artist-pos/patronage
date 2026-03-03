interface PortfolioImage {
  id: string;
  url: string;
  caption: string | null;
}

function PortfolioItem({ img }: { img: PortfolioImage }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="border border-border overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt={img.caption ?? "Portfolio work"}
          // Mobile: full column width, natural height.
          // Desktop: fixed 300px height, auto width (natural aspect ratio — no cropping).
          className="w-full h-auto sm:h-[300px] sm:w-auto block"
        />
      </div>
      {img.caption && (
        <p className="text-xs text-muted-foreground leading-snug font-mono">
          {img.caption}
        </p>
      )}
    </div>
  );
}

export function PortfolioGrid({ images }: { images: PortfolioImage[] }) {
  return (
    // Mobile: 2-column grid, natural height.
    // Desktop: flex-wrap row — images sit at natural width, left-aligned.
    // No flex-grow on items so the last row never stretches to fill the screen.
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-4">
      {images.map((img) => (
        <PortfolioItem key={img.id} img={img} />
      ))}
    </div>
  );
}
