export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const metadata = { title: "New Post — Blog — Admin — Patronage" };

export default async function NewBlogPostPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">New Post</h1>
      </div>
      <BlogEditor userId={user.id} />
    </div>
  );
}
