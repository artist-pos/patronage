import { COPY } from "@/lib/rabobank/artist-copy";

/** Page frame for the invited-artist pages: light only, phone first, Patronage mark at the foot. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#fafaf9] text-stone-900 [color-scheme:light]">
      <main className="mx-auto max-w-2xl space-y-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        {children}
        <footer className="flex items-center gap-2 border-t border-stone-200 pt-6 text-[15px] font-semibold tracking-tight text-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Favicon_Bleed_512.png" alt="" width={22} height={22} />
          Patronage
        </footer>
      </main>
    </div>
  );
}

export function ClosedNotice() {
  return (
    <div className="space-y-3" role="status">
      <h1 className="text-3xl font-light tracking-tight">{COPY.closed.heading}</h1>
      <p className="leading-relaxed text-stone-600">{COPY.closed.body}</p>
    </div>
  );
}
