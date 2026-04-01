"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deletePost } from "@/app/admin/blog/actions";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BlogAdminList({ posts }: { posts: PostRow[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    startTransition(async () => {
      await deletePost(id);
      setDeletingId(null);
    });
  }

  if (posts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 border-t border-border">
        No posts yet.{" "}
        <Link href="/admin/blog/new" className="underline underline-offset-2">
          Write your first post.
        </Link>
      </p>
    );
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="py-2 pr-4 font-medium text-muted-foreground">Title</th>
          <th className="py-2 pr-4 font-medium text-muted-foreground">Status</th>
          <th className="py-2 pr-4 font-medium text-muted-foreground">Date</th>
          <th className="py-2 font-medium text-muted-foreground text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.id} className="border-b border-border group">
            <td className="py-3 pr-4">
              <p className="font-medium text-sm">{post.title}</p>
              <p className="text-muted-foreground">/blog/{post.slug}</p>
            </td>
            <td className="py-3 pr-4">
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                  post.status === "published"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-stone-100 text-stone-500"
                }`}
              >
                {post.status}
              </span>
            </td>
            <td className="py-3 pr-4 text-muted-foreground">
              {fmt(post.published_at ?? post.created_at)}
            </td>
            <td className="py-3 text-right">
              <div className="flex items-center justify-end gap-3">
                <Link
                  href={`/admin/blog/${post.id}/edit`}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(post.id, post.title)}
                  disabled={isPending && deletingId === post.id}
                  className="text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  {deletingId === post.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
