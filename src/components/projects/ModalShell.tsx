"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function ModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <>
      {/* Button is a sibling of the scroll container so iOS Safari keeps it fixed */}
      <button
        onClick={() => router.back()}
        aria-label="Close"
        className="fixed top-4 right-4 z-[51] p-1.5 bg-background border border-black text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <div
        className="fixed inset-0 z-50 backdrop-blur-md bg-white/20 overflow-y-auto"
        onClick={() => router.back()}
      >
        <div
          className="relative max-w-2xl mx-auto px-4 sm:px-6 py-12 bg-background"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}
