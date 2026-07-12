import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog — Patronage",
  description:
    "Insights, news, and stories from the Patronage team — connecting artists with opportunity in Aotearoa and beyond.",
  alternates: { canonical: "https://patronage.nz/blog" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Excerpt + read time are derived from the body (no dedicated columns).
// Category comes from blog_posts.category (migration 169), falling back to
// the derived label (featured artist → Feature, otherwise Essay) when unset.
function stripHtml(body: string | null): string {
  return (body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function readTime(text: string): string {
  const mins = Math.max(1, Math.round(text.split(" ").length / 200));
  return `${mins} min read`;
}

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, image_url, body, category, published_at, created_at, featured_profile_id")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-10 sm:px-12">
      <h1 className="mb-2 text-[32px] font-semibold tracking-[-0.02em]">Blog</h1>
      <p className="mb-9 text-[15px] text-[color:var(--fg-muted)]">
        Insights, news, and stories from the Patronage team.
      </p>

      {(!posts || posts.length === 0) ? (
        <p className="text-muted-foreground">No posts yet — check back soon.</p>
      ) : (
        /* 2px warm-grey gaps are the only separation between cards — no borders */
        <div className="grid grid-cols-1 gap-[2px] bg-feed-bg p-[2px] sm:grid-cols-2">
          {posts.map((post) => {
            const category: string =
              post.category ??
              (post.featured_profile_id || /^feature\b/i.test(post.title) ? "feature" : "essay");
            const text = stripHtml(post.body);
            const excerpt = text.length > 220 ? text.slice(0, 217) + "…" : text;
            const author = category === "feature" ? "Patronage Editorial" : "Blake Aitken";
            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block bg-card"
              >
                <div className="h-[240px] w-full overflow-hidden bg-feed-bg">
                  {post.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.image_url}
                      alt=""
                      className="h-full w-full object-cover transition-opacity duration-150 group-hover:opacity-[.88]"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="px-5 pb-[22px] pt-[18px]">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-brand">
                    {category}
                  </span>
                  <h2 className="my-2 text-[17px] font-semibold leading-[1.35] tracking-[-0.01em]">
                    {post.title}
                  </h2>
                  {excerpt && (
                    <p className="mb-4 line-clamp-2 text-[13.5px] leading-[1.55] text-[color:var(--fg-muted)]">
                      {excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-5 shrink-0"
                      style={{ background: "linear-gradient(145deg,#333,#555)" }}
                    />
                    <span className="text-xs font-medium">{author}</span>
                    <span className="text-[11px] text-[color:var(--fg-subtle)]">
                      · {readTime(text)} · {formatDate(post.published_at ?? post.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
