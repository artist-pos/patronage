"use client";

import { useRouter } from "next/navigation";

interface Props {
  username: string;
  children: React.ReactNode;
  className?: string;
}

export function ArtistProfileLink({ username, children, className }: Props) {
  const router = useRouter();
  return (
    <button className={className} onClick={() => router.replace(`/${username}`)}>
      {children}
    </button>
  );
}
