"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { Opportunity, OpportunityCollaborator } from "@/types/database";

interface Section {
  id: string;
  label: string;
  pipelineOnly?: boolean;
}

const SECTIONS: Section[] = [
  { id: "basics",         label: "Basics" },
  { id: "form",           label: "Application form",  pipelineOnly: true },
  { id: "rubric",         label: "Scoring rubric",    pipelineOnly: true },
  { id: "post-selection", label: "Post-selection",    pipelineOnly: true },
  { id: "commerce",       label: "Commerce" },
  { id: "collaborators",  label: "Collaborators" },
];

interface Props {
  opp: Opportunity;
  isPipeline: boolean;
  opportunityId: string;
  children: React.ReactNode;
}

export function ManageShell({ opp, isPipeline, opportunityId, children }: Props) {
  const [activeSection, setActiveSection] = useState("basics");
  const observerRef = useRef<IntersectionObserver | null>(null);

  const visibleSections = SECTIONS.filter((s) => !s.pipelineOnly || isPipeline);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    for (const s of visibleSections) {
      const el = document.getElementById(s.id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPipeline]);

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-background border-b border-black">
        <div className="max-w-[1600px] mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/partner/dashboard" className="text-xs text-stone-400 hover:text-foreground shrink-0">
              ← Dashboard
            </Link>
            <span className="text-stone-300 shrink-0">·</span>
            <h1 className="text-sm font-semibold truncate">{opp.title || "Untitled listing"}</h1>
            <span className="text-xs text-stone-400 shrink-0 capitalize">{opp.status}</span>
          </div>
          <Link
            href={`/partner/dashboard/${opportunityId}`}
            className="text-xs border border-black/20 px-3 py-1.5 hover:border-black transition-colors shrink-0"
          >
            View applications →
          </Link>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex gap-8 items-start">
          {/* Sticky left nav */}
          <div className="hidden lg:block w-48 shrink-0 sticky top-[57px] py-8">
            <nav className="space-y-0.5">
              {visibleSections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollTo(s.id)}
                  className={`w-full text-left text-sm px-3 py-2 transition-colors rounded ${
                    activeSection === s.id
                      ? "bg-stone-100 font-medium text-foreground"
                      : "text-stone-500 hover:text-foreground hover:bg-stone-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 py-8 pb-32 space-y-16">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
