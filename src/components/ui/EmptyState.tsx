import Link from "next/link";

interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Consistent empty-state placeholder used across all three workspaces
 * (studio, dashboard, partner dashboard).  Keeps the same visual language
 * everywhere: centred text, dashed border, optional CTA button.
 */
export function EmptyState({ title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="py-16 text-center border border-dashed border-border space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-block text-sm border border-black px-4 py-2 hover:bg-muted transition-colors mt-1"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
