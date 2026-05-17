export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BlogAdminList } from "@/components/admin/BlogAdminList";

export const metadata = { title: "Blog — Admin — Patronage" };

export default async function AdminBlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, slug, status, published_at, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Blog</h1>
          <p className="text-xs text-muted-foreground">
            {posts?.length ?? 0} post{(posts?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="text-xs font-medium px-4 py-2 rounded-lg bg-black text-white hover:opacity-80 transition-opacity"
        >
          New Post
        </Link>
      </div>

      <BlogAdminList posts={posts ?? []} />
    </div>
  );
}
