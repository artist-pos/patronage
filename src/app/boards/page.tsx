import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { hydrateBoardItems } from "@/lib/boards";
import { NewBoardForm } from "@/components/boards/NewBoardForm";
import type { Board, BoardItemType } from "@/types/database";

export const metadata: Metadata = { title: "Your boards" };

const BLURB: Record<string, string> = {
  partner: "Shortlists of artists you might commission. Artists never see them; invite them to apply when you're ready.",
  patron: "Works and artists you might acquire, commission or support.",
  artist: "References, works and artists you want to come back to.",
};

export default async function BoardsPage() {
  const { supabase, user } = await getServerUser();
  if (!user) redirect("/auth/login?redirect=/boards");

  const [{ data: me }, { data: boardRows }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("boards").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }),
  ]);
  const boards = (boardRows ?? []) as Board[];

  const { data: itemRows } = boards.length
    ? await supabase
        .from("board_items")
        .select("board_id, item_type, item_id, created_at")
        .in("board_id", boards.map((b) => b.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const items = (itemRows ?? []) as Array<{ board_id: string; item_type: BoardItemType; item_id: string }>;

  const counts = new Map<string, number>();
  const covers: typeof items = [];
  for (const i of items) {
    const n = counts.get(i.board_id) ?? 0;
    counts.set(i.board_id, n + 1);
    if (n < 4) covers.push(i);
  }
  const tiles = await hydrateBoardItems(supabase, covers);
  const coverFor = (boardId: string) =>
    covers
      .filter((c) => c.board_id === boardId)
      .map((c) => tiles.find((t) => t.type === c.item_type && t.id === c.item_id)?.imageUrl)
      .filter((u): u is string => !!u)
      .slice(0, 4);

  const role = me?.role === "owner" ? "artist" : me?.role ?? "artist";

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[560px] space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your boards</h1>
          <p className="text-sm text-muted-foreground">{BLURB[role] ?? BLURB.artist}</p>
        </div>
        <NewBoardForm />
      </div>

      {boards.length === 0 ? (
        <p className="max-w-[480px] text-sm text-muted-foreground">
          Nothing saved yet. Use the bookmark on a studio update, a work or an artist&rsquo;s profile to start a board.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {boards.map((b) => {
            const cover = coverFor(b.id);
            const n = counts.get(b.id) ?? 0;
            return (
              <Link key={b.id} href={`/boards/${b.id}`} className="group block">
                <div className="mb-2 grid aspect-square grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-muted">
                  {cover.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={src}
                      alt=""
                      loading="lazy"
                      className={`h-full w-full object-cover transition-opacity group-hover:opacity-85 ${
                        cover.length === 1 ? "col-span-2 row-span-2" : cover.length === 2 ? "row-span-2" : cover.length === 3 && i === 0 ? "row-span-2" : ""
                      }`}
                    />
                  ))}
                </div>
                <p className="truncate text-sm font-medium">{b.title}</p>
                <p className="font-mono text-xs text-[color:var(--fg-subtle)]">
                  {n} saved{b.visibility === "link" ? " · shared by link" : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
