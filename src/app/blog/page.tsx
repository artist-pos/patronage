import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Patronage",
  description:
    "Insights, news, and stories from the Patronage team — connecting artists with opportunity in Aotearoa and beyond.",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, image_url, published_at, created_at, featured_profile_id")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-16 space-y-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
        <p className="text-muted-foreground">
          Insights, news, and stories from the Patronage team.
        </p>
      </div>

      {(!posts || posts.length === 0) ? (
        <p className="text-muted-foreground">No posts yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group space-y-3"
            >
              <div className={`aspect-video overflow-hidden bg-stone-100 flex items-center justify-center ${post.featured_profile_id ? "border-[3px] border-black" : ""}`}>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-full h-full object-contain transition-opacity duration-300 group-hover:opacity-85"
                  />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {formatDate(post.published_at ?? post.created_at)}
                </p>
                <h2 className="font-semibold text-base leading-snug group-hover:opacity-70 transition-opacity">
                  {post.title}
                </h2>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
