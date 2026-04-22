import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const metadata = { title: "Edit Post — Blog — Admin — Patronage" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: { user } }, { data: post }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("blog_posts")
      .select("*, featured_profile:profiles(id, username, full_name, avatar_url)")
      .eq("id", id)
      .single(),
  ]);

  if (!user) redirect("/auth/login");
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Edit Post</h1>
        <p className="text-xs text-muted-foreground">
          {post.status === "published" ? "Published" : "Draft"} ·{" "}
          <a
            href={`/blog/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View post
          </a>
        </p>
      </div>
      <BlogEditor post={post} userId={user.id} />
    </div>
  );
}
