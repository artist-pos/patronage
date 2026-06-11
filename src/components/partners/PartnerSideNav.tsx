"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "proposal",   label: "Proposal" },
  { id: "calculator", label: "Calculator" },
  { id: "explore",    label: "Explore" },
];

export function PartnerSideNav() {
  const [active, setActive] = useState("proposal");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-25% 0px -55% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const headerHeight =
      document.querySelector("header")?.getBoundingClientRect().height ?? 72;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 24;
    window.scrollTo({ top, behavior: "smooth" });
  }

  return (
    <nav
      aria-label="Page sections"
      className="fixed left-5 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-center gap-0"
    >
      {SECTIONS.map(({ id, label }, i) => {
        const isActive = active === id;
        const isLast = i === SECTIONS.length - 1;

        return (
          <div key={id} className="flex flex-col items-center">
            {/* Dot + tooltip */}
            <div className="relative group flex items-center">
              <button
                onClick={() => scrollTo(id)}
                aria-label={`Scroll to ${label}`}
                className="relative z-10 flex items-center justify-center w-5 h-5"
              >
                <span
                  className={`block rounded-full transition-all duration-200 ${
                    isActive
                      ? "w-2.5 h-2.5 bg-stone-800"
                      : "w-1.5 h-1.5 bg-stone-300 group-hover:bg-stone-500"
                  }`}
                />
              </button>

              {/* Tooltip */}
              <span className="pointer-events-none absolute left-6 font-mono text-[10px] uppercase tracking-widest text-stone-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {label}
              </span>
            </div>

            {/* Connector line between dots */}
            {!isLast && (
              <span className="w-px h-8 bg-stone-200" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
