"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { verifyProvenanceLink, declineProvenanceLink } from "@/app/dashboard/actions";

interface ProvenanceItem {
  id: string;
  artwork_id: string;
  artwork_url: string;
  artwork_caption: string | null;
  artist_username: string;
  artist_name: string | null;
}

interface Props {
  links: ProvenanceItem[];
}

export function ProvenanceBanner({ links: initialLinks }: Props) {
  const [links, setLinks] = useState(initialLinks);
  const [, startTransition] = useTransition();

  if (links.length === 0) return null;

  function handleVerify(linkId: string) {
    startTransition(async () => {
      await verifyProvenanceLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    });
  }

  function handleDecline(linkId: string) {
    startTransition(async () => {
      await declineProvenanceLink(linkId);
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Collection Verification
      </p>
      {links.map((link) => (
        <div
          key={link.id}
          className="border border-border p-4 flex items-center gap-4"
        >
          {/* Artwork thumbnail */}
          <div className="flex-none relative w-14 h-14 overflow-hidden bg-muted border border-border">
            <Image
              src={link.artwork_url}
              alt={link.artwork_caption ?? "Artwork"}
              fill
              unoptimized
              className="object-cover"
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-sm leading-snug">
              <Link
                href={`/${link.artist_username}`}
                className="font-semibold hover:underline underline-offset-2"
              >
                {link.artist_name ?? link.artist_username}
              </Link>{" "}
              linked{" "}
              <span className="font-medium">
                {link.artwork_caption ?? "an artwork"}
              </span>{" "}
              to your collection.
            </p>
            <p className="text-xs text-muted-foreground">
              Verify to confirm this work is in your collection.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleVerify(link.id)}
              className="text-xs border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
            >
              Verify
            </button>
            <button
              onClick={() => handleDecline(link.id)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
