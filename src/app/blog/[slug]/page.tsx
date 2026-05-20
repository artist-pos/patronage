import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BlogImages } from "@/components/blog/BlogImages";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://patronage.nz";

// Deduplicates DB fetch between generateMetadata and the page component.
const getPost = cache(async (slug: string) => {
  const supabase = await createClient();
  const now = new Date().toISOString();
  return supabase
    .from("blog_posts")
    .select("*, featured_profile:profiles(id, username, full_name, bio, avatar_url)")
    .eq("slug", slug)
    .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`)
    .single();
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { data: post } = await getPost(slug);

  if (!post) return { title: "Post not found — Patronage" };

  const title = `${post.title} — Patronage Blog`;
  const canonicalUrl = `${BASE_URL}/blog/${slug}`;

  // Strip HTML tags for description, take first 155 chars
  const rawText = (post.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const description = rawText.length > 155 ? rawText.slice(0, 152) + "…" : rawText || undefined;

  const publishedTime = post.published_at ?? post.created_at ?? undefined;
  const modifiedTime = post.updated_at ?? publishedTime;

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
      ...(modifiedTime && { modifiedTime }),
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

  const now = new Date().toISOString();

  const [{ data: post }, { data: otherPosts }] = await Promise.all([
    getPost(slug),
    supabase
      .from("blog_posts")
      .select("slug, title, image_url, published_at, created_at")
      .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`)
      .neq("slug", slug)
      .order("published_at", { ascending: false })
      .limit(6),
  ]);

  if (!post) notFound();

  const sidebar = otherPosts ?? [];

  const canonicalUrl = `${BASE_URL}/blog/${slug}`;
  const rawText = (post.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const description = rawText.length > 155 ? rawText.slice(0, 152) + "…" : rawText || undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${canonicalUrl}#article`,
        headline: post.title,
        url: canonicalUrl,
        ...(description && { description }),
        datePublished: post.published_at ?? post.created_at,
        dateModified: (post as any).updated_at ?? post.published_at ?? post.created_at,
        ...(post.image_url && {
          image: { "@type": "ImageObject", url: post.image_url, width: 1200, height: 630 },
        }),
        author: { "@type": "Organization", name: "Patronage", url: BASE_URL },
        publisher: { "@type": "Organization", name: "Patronage", url: BASE_URL },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
        ...(post.featured_profile && {
          about: {
            "@type": "Person",
            name: post.featured_profile.full_name ?? post.featured_profile.username,
            url: `${BASE_URL}/${post.featured_profile.username}`,
          },
        }),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Blog", item: `${BASE_URL}/blog` },
          { "@type": "ListItem", position: 2, name: post.title, item: canonicalUrl },
        ],
      },
    ],
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-16 space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
          {/* Featured image(s) */}
          {post.image_url && (
            <div className="overflow-hidden">
              <BlogImages imageUrl={post.image_url} imageUrl2={post.image_url_2} />
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

          {/* Featured artist card */}
          {post.featured_profile && (
            <Link
              href={`/${post.featured_profile.username}`}
              className="flex items-center gap-4 max-w-[720px] p-4 border-[3px] border-black rounded-xl hover:bg-muted/30 transition-colors"
            >
              {post.featured_profile.avatar_url ? (
                <Image
                  src={post.featured_profile.avatar_url}
                  alt={post.featured_profile.full_name ?? post.featured_profile.username}
                  width={56}
                  height={56}
                  className="rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-stone-200 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">
                  Featured Artist
                </p>
                <p className="text-sm font-semibold leading-snug">
                  {post.featured_profile.full_name ?? post.featured_profile.username}
                </p>
                {post.featured_profile.bio && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {post.featured_profile.bio}
                  </p>
                )}
              </div>
            </Link>
          )}

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
                  <div className="aspect-video overflow-hidden rounded-lg bg-stone-100 flex items-center justify-center">
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
