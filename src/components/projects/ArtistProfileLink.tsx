"use client";

import Link from "next/link";

interface Props {
  username: string;
  children: React.ReactNode;
  className?: string;
}

export function ArtistProfileLink({ username, children, className }: Props) {
  return (
    <Link href={`/${username}`} className={className}>
      {children}
    </Link>
  );
}
