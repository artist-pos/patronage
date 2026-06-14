"use client";

interface Props {
  username: string;
  children: React.ReactNode;
  className?: string;
}

// Used inside modal intercepting routes (@modal). Must use window.location.href
// (hard nav) to exit the parallel-route slot — a soft Next.js Link navigation
// changes the main slot but leaves the modal slot active, keeping the modal open.
export function ArtistProfileLink({ username, children, className }: Props) {
  return (
    <a
      href={`/${username}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        window.location.href = `/${username}`;
      }}
    >
      {children}
    </a>
  );
}
