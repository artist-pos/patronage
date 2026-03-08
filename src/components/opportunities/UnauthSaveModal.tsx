"use client";

import Link from "next/link";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function UnauthSaveModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-md p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm border border-black bg-background">
        <div className="flex items-center justify-between border-b border-black px-5 py-3">
          <h2 className="text-sm font-semibold">Save this opportunity</h2>
          <button onClick={onClose} aria-label="Close" className="hover:opacity-60 transition-opacity">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Create a free Patronage account to save grants, residencies, and open calls — and track them in your personal dashboard with deadline reminders.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/auth/signup"
              className="w-full bg-black text-white text-sm py-2.5 px-4 text-center hover:opacity-80 transition-opacity"
            >
              Create account →
            </Link>
            <Link
              href="/auth/login"
              className="w-full border border-border text-sm py-2.5 px-4 text-center hover:bg-muted transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
