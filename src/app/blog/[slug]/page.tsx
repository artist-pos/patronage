import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, image_url, body, published_at, created_at")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) return { title: "Post not found — Patronage" };

  const title = `${post.title} — Patronage Blog`;
  const canonicalUrl = `${BASE_URL}/blog/${slug}`;

  // Strip HTML tags for description, take first 155 chars
  const rawText = (post.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const description = rawText.length > 155 ? rawText.slice(0, 152) + "…" : rawText || undefined;

  const publishedTime = post.published_at ?? post.created_at ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "article",
      ...(publishedTime && { publishedTime }),
      ...(post.image_url && {
        images: [{ url: post.image_url, width: 1200, height: 630, alt: post.title }],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(post.image_url && { images: [post.image_url] }),
    },
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const [{ data: post }, { data: otherPosts }] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single(),
    supabase
      .from("blog_posts")
      .select("slug, title, image_url, published_at, created_at")
      .eq("status", "published")
      .neq("slug", slug)
      .order("published_at", { ascending: false })
      .limit(20),
  ]);

  if (!post) notFound();

  const sidebar = otherPosts ?? [];

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-16 space-y-10">
      {/* Back link */}
      <Link
        href="/blog"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Blog
      </Link>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12 lg:gap-16 items-start">

        {/* ── Left: article ── */}
        <article className="space-y-8 min-w-0">
          {/* Featured image */}
          {post.image_url && (
            <div className="overflow-hidden rounded-xl">
              <img
                src={post.image_url}
                alt=""
                className="w-full h-auto"
              />
            </div>
          )}

          {/* Header */}
          <div className="space-y-2 max-w-[720px]">
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              {post.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(post.published_at ?? post.created_at)}
            </p>
          </div>

          {/* Body — capped at comfortable reading width */}
          {post.body && (
            <div
              className="
                max-w-[720px]
                text-sm leading-relaxed text-foreground
                [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-3
                [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-2
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
                [&_p]:mb-4
                [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-4 [&_ul>li]:mb-1
                [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-4 [&_ol>li]:mb-1
                [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-70
                [&_strong]:font-semibold
                [&_em]:italic
                [&_blockquote]:border-l-2 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-4
                [&_hr]:border-stone-200 [&_hr]:my-8
              "
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
          )}
        </article>

        {/* ── Right: sidebar ── */}
        {sidebar.length > 0 && (
          <aside className="lg:sticky lg:top-6 lg:self-start space-y-5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
              More from the blog
            </p>
            <div className="space-y-4">
              {sidebar.map(p => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col gap-2"
                >
                  <div className="aspect-video overflow-hidden rounded-lg bg-black flex items-center justify-center">
                    {p.image_url && (
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-full h-full object-contain group-hover:opacity-85 transition-opacity"
                      />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-snug group-hover:underline group-hover:underline-offset-2">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(p.published_at ?? p.created_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
