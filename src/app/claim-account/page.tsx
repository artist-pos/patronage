import type { Metadata } from "next";
import { ClaimAccountForm } from "./ClaimAccountForm";

export const metadata: Metadata = {
  title: "Claim your collection — Patronage",
};

export default function ClaimAccountPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF9] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Claim your collection</h1>
          <p className="text-sm text-stone-500 mt-2">
            Set a password to access your Patronage account and view the works in your collection.
          </p>
        </div>
        <ClaimAccountForm />
      </div>
    </main>
  );
}
