import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { hydrateBoardItems } from "@/lib/boards";
import type { BoardItemType } from "@/types/database";

// A board shared by link is for the people it was sent to, not for search.
export const metadata: Metadata = { title: "Board", robots: { index: false, follow: false } };

interface Props {
  params: Promise<{ token: string }>;
}

interface SharedRow {
  board_id: string;
  title: string;
  description: string | null;
  owner_username: string;
  owner_name: string | null;
  item_type: BoardItemType | null;
  item_id: string | null;
}

const TYPE_LABEL: Record<BoardItemType, string> = {
  artwork: "Work",
  update: "Studio update",
  artist: "Artist",
};

export default async function SharedBoardPage({ params }: Props) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) notFound();

  const supabase = createPublicClient();
  const { data } = await supabase.rpc("get_shared_board", { token });
  const rows = (data ?? []) as SharedRow[];
  if (rows.length === 0) notFound();

  const board = rows[0];
  const tiles = await hydrateBoardItems(
    supabase,
    rows
      .filter((r) => r.item_type && r.item_id)
      .map((r) => ({ item_type: r.item_type!, item_id: r.item_id! })),
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6">
      <div className="mb-8 max-w-[640px]">
        <h1 className="text-2xl font-semibold tracking-tight">{board.title}</h1>
        {board.description && <p className="mt-2 text-sm text-muted-foreground">{board.description}</p>}
        <p className="mt-2 font-mono text-xs text-[color:var(--fg-subtle)]">
          A board by{" "}
          <Link href={`/${board.owner_username}`} className="underline underline-offset-2 hover:text-foreground">
            {board.owner_name ?? board.owner_username}
          </Link>{" "}
          · {tiles.length} saved
        </p>
      </div>

      {tiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">This board is empty.</p>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {tiles.map((t) => (
            <Link key={`${t.type}:${t.id}`} href={t.href} className="block bg-card transition-opacity hover:opacity-90">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.imageUrl} alt="" loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-muted font-mono text-xs text-muted-foreground">
                  {TYPE_LABEL[t.type]}
                </div>
              )}
              <div className="p-3">
                <p className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--fg-subtle)]">{TYPE_LABEL[t.type]}</p>
                <p className="line-clamp-2 text-sm font-medium leading-snug">{t.title}</p>
                {t.subtitle && <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
