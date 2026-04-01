import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) return { title: "Post not found — Patronage" };

  return {
    title: `${post.title} — Patronage Blog`,
    openGraph: post.image_url
      ? { images: [{ url: post.image_url }] }
      : undefined,
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
  const { data: post } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) notFound();

  return (
    <article className="max-w-2xl mx-auto px-6 py-16 space-y-8">
      {/* Back link */}
      <Link
        href="/blog"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Blog
      </Link>

      {/* Featured image */}
      {post.image_url && (
        <div className="overflow-hidden rounded-xl">
          <img
            src={post.image_url}
            alt=""
            className="w-full max-h-[480px] object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight leading-tight">
          {post.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(post.published_at ?? post.created_at)}
        </p>
      </div>

      {/* Body */}
      {post.body && (
        <div
          className="
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
  );
}
