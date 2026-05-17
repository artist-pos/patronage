"use client";

import Image from "next/image";
import Link from "next/link";

interface Update {
  id: string;
  content_type: string;
  image_url: string | null;
  caption: string | null;
  text_content: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  projectTitle: string;
  updates: Update[];
}

export function ProcessThread({ projectId, projectTitle, updates }: Props) {
  const count = updates.length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {count === 0
          ? `No updates yet — ${projectTitle}`
          : `${count} update${count !== 1 ? "s" : ""} from ${projectTitle}`}
      </p>
      {count > 0 && (
        <div className="border border-border divide-y divide-border">
          {updates.map((u) => (
            <div key={u.id} className="px-4 py-3 flex gap-3">
              {u.image_url && (
                <div className="w-12 h-12 shrink-0 relative overflow-hidden bg-muted">
                  <Image
                    src={u.image_url}
                    alt={u.caption ?? ""}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-0.5">
                {u.caption && (
                  <p className="text-sm line-clamp-2">{u.caption}</p>
                )}
                {u.text_content && !u.caption && (
                  <p className="text-sm line-clamp-2">{u.text_content}</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("en-NZ", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Link
        href={`/threads/${projectId}`}
        className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
      >
        View full thread →
      </Link>
    </div>
  );
}
