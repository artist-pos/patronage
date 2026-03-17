"use client";

import { useRouter } from "next/navigation";

interface Props {
  username: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * In the feed post modal (a parallel route), a plain <Link> to the artist
 * profile soft-navigates and pushes to history, meaning pressing back from
 * the profile returns to the modal. Instead we use router.replace so the
 * modal history entry is replaced by the profile URL — back then goes to
 * the feed.
 */
export function ArtistProfileLink({ username, children, className }: Props) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.replace(`/${username}`)}
      className={className}
    >
      {children}
    </button>
  );
}
