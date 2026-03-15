"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

export function ModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // If the user navigated away from the intercepted route while the modal was
  // still open (e.g. clicked the artist name link), router.back() would return
  // to /feed rather than the current page. Push to the current pathname instead
  // so the modal is dismissed and the user stays where they are.
  function close() {
    if (pathname.startsWith("/threads/")) {
      router.back();
    } else {
      router.push(pathname);
    }
  }

  return (
    <>
      {/* Button is a sibling of the scroll container so iOS Safari keeps it fixed */}
      <button
        onClick={close}
        aria-label="Close"
        className="fixed top-4 right-4 z-[51] p-1.5 bg-background border border-black text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <div
        className="fixed inset-0 z-50 backdrop-blur-md bg-white/20 overflow-y-auto"
        onClick={close}
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
