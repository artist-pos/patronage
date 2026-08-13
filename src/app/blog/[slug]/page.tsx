import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BlogImages } from "@/components/blog/BlogImages";
import { BlogBodyZoom } from "@/components/blog/BlogBodyZoom";
import { stripBodyHtml } from "@/lib/blog-text";
import { ShareTrigger } from "@/components/share/ShareTrigger";
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
    .select("*, featured_profile:profiles(id, username, full_name, bio, avatar_url, city, country, disciplines, medium)")
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
  const rawText = stripBodyHtml(post.body);
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
  const rawText = stripBodyHtml(post.body);
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
        dateModified: (post as { updated_at?: string | null }).updated_at ?? post.published_at ?? post.created_at,
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

  // Meta lines (Practitioner / Location / Discipline) — feature-artist posts only
  const fp = post.featured_profile as {
    id: string; username: string; full_name: string | null; bio: string | null;
    avatar_url: string | null; city?: string | null; country?: string | null;
    disciplines?: string[] | null; medium?: string[] | null;
  } | null;
  const metaLines: Array<[string, string]> = [];
  if (fp) {
    metaLines.push(["Practitioner", fp.full_name ?? fp.username]);
    const loc = [fp.city, fp.country].filter(Boolean).join(", ");
    if (loc) metaLines.push(["Location", loc]);
    const disciplines = (fp.disciplines?.length ? fp.disciplines : fp.medium ?? [])
      .map((d) => d.replace(/_/g, " "))
      .join(" / ");
    if (disciplines) metaLines.push(["Discipline", disciplines]);
  }

  return (
    <div className="mx-auto max-w-[1280px] px-5 pb-16 pt-5 sm:px-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Back link */}
      <Link
        href="/blog"
        className="text-[13px] text-[color:var(--fg-muted)] hover:text-foreground transition-colors"
      >
        ← Blog
      </Link>

      {/* Two-column layout */}
      <div className="mt-5 grid grid-cols-1 items-start gap-12 lg:grid-cols-[2.2fr_1fr]">

        {/* ── Left: article ── */}
        <article className="min-w-0">
          {/* Featured image(s) */}
          {post.image_url && (
            <div className="mb-6 overflow-hidden">
              <BlogImages imageUrl={post.image_url} imageUrl2={post.image_url_2} />
            </div>
          )}

          {/* Header */}
          <div className="mb-1.5 flex items-start justify-between gap-4">
            <h1 className="flex-1 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
              {post.title}
            </h1>
            {post.image_url && (() => {
              const imageOptions = [
                { url: post.image_url, label: "Image 1" },
                ...(post.image_url_2 ? [{ url: post.image_url_2, label: "Image 2" }] : []),
              ];
              return (
                <ShareTrigger
                  variant="icon"
                  payload={{
                    type: "blog",
                    title: post.title,
                    sub: "",
                    price: null,
                    tag: "Blog",
                    handle: "patronage.nz",
                    imageUrl: post.image_url,
                    shareUrl: canonicalUrl,
                    imageOptions: imageOptions.length > 1 ? imageOptions : undefined,
                  }}
                  className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-white text-[color:var(--fg-muted)] transition-colors hover:border-foreground hover:text-foreground"
                />
              );
            })()}
          </div>
          <p className="mb-[22px] text-[13px] text-[color:var(--fg-subtle)]">
            {formatDate(post.published_at ?? post.created_at)}
          </p>

          {/* Byline box — featured artist, or the house author for essays */}
          {fp ? (
            <Link
              href={`/${fp.username}`}
              className="mb-7 flex items-start gap-3.5 bg-feed-bg px-[18px] py-4 transition-opacity hover:opacity-85"
            >
              {fp.avatar_url ? (
                <Image
                  src={fp.avatar_url}
                  alt={fp.full_name ?? fp.username}
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 object-cover"
                />
              ) : (
                <div
                  className="h-11 w-11 shrink-0"
                  style={{ background: "linear-gradient(145deg,#333,#555)" }}
                />
              )}
              <div className="min-w-0">
                <p className="mb-[3px] text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                  Featured artist
                </p>
                <p className="mb-[3px] text-[14.5px] font-semibold leading-snug">
                  {fp.full_name ?? fp.username}
                </p>
                {fp.bio && (
                  <p className="line-clamp-2 text-[12.5px] leading-[1.55] text-[color:var(--fg-muted)]">
                    {fp.bio}
                  </p>
                )}
              </div>
            </Link>
          ) : (
            <div className="mb-7 flex items-start gap-3.5 bg-feed-bg px-[18px] py-4">
              <div
                className="h-11 w-11 shrink-0"
                style={{ background: "linear-gradient(145deg,#333,#555)" }}
              />
              <div className="min-w-0">
                <p className="mb-[3px] text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">
                  Written by
                </p>
                <p className="mb-[3px] text-[14.5px] font-semibold leading-snug">Blake Aitken</p>
                <p className="text-[12.5px] leading-[1.55] text-[color:var(--fg-muted)]">
                  I&rsquo;m an artist working across public interventions and cultural
                  infrastructure. I&rsquo;m currently building Patronage to help artists find
                  funding, share their work, and connect with the people who support it.
                </p>
              </div>
            </div>
          )}

          {/* Meta lines — feature posts only */}
          {metaLines.length > 0 && (
            <div className="mb-5 text-[13.5px] leading-[1.9] text-[color:var(--fg-muted)]">
              {metaLines.map(([label, value]) => (
                <div key={label}>
                  <strong className="font-semibold text-foreground">{label}:</strong> {value}
                </div>
              ))}
            </div>
          )}

          {/* Body */}
          {post.body && (
            <div
              id="blog-body"
              className="
                text-foreground
                [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:mt-8 [&_h1]:mb-3
                [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:mt-8 [&_h2]:mb-3
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2
                [&_p]:text-[15.5px] [&_p]:leading-[1.75] [&_p]:mb-[18px]
                [&_li]:text-[15.5px] [&_li]:leading-[1.75]
                [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-4 [&_ul>li]:mb-1
                [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-4 [&_ol>li]:mb-1
                [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:opacity-70
                [&_strong]:font-semibold
                [&_em]:italic
                [&_blockquote]:border-l-2 [&_blockquote]:border-stone-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:mb-4
                [&_hr]:border-stone-200 [&_hr]:my-8
                [&_figure_img]:cursor-zoom-in
              "
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
          )}
          {/* Click-to-zoom for body figures — listener only, so the article HTML
              stays server-rendered instead of crossing the RSC boundary. */}
          {post.body?.includes("data-figure-image") && <BlogBodyZoom containerId="blog-body" />}
        </article>

        {/* ── Right: sidebar — thumbnail rows, hairline dividers ── */}
        {sidebar.length > 0 && (
          <aside className="border-t border-border pt-6 lg:sticky lg:top-[72px] lg:self-start lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-[color:var(--fg-subtle)]">
              More from the blog
            </p>
            <div>
              {sidebar.map(p => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="flex gap-3 border-b border-border py-3 transition-opacity hover:opacity-80"
                >
                  <div className="h-[76px] w-[76px] shrink-0 overflow-hidden bg-feed-bg">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-[13px] font-semibold leading-[1.35]">
                      {p.title}
                    </p>
                    <p className="text-[11.5px] text-[color:var(--fg-subtle)]">
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
