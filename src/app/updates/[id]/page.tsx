import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getUpdateById } from "@/lib/feed";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const update = await getUpdateById(id);
  if (!update) return { title: "Update not found — Patronage" };
  const name = update.artist_full_name ?? update.artist_username;
  return {
    title: `${name} — Studio Update | Patronage`,
    description: update.caption ?? `Studio update from ${name} on Patronage.`,
    openGraph: {
      images: [{ url: update.image_url, alt: update.caption ?? name }],
    },
  };
}

export default async function UpdatePage({ params }: Props) {
  const { id } = await params;
  const update = await getUpdateById(id);
  if (!update) notFound();

  const name = update.artist_full_name ?? update.artist_username;
  const date = new Date(update.created_at).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">

      {/* Back */}
      <Link href="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to feed
      </Link>

      {/* Image */}
      <div className="border border-black overflow-hidden bg-muted">
        <Image
          src={update.image_url}
          alt={update.caption ?? `Studio update by ${name}`}
          width={1200}
          height={900}
          priority
          unoptimized
          className="w-full h-auto max-h-[70vh] object-contain"
        />
      </div>

      {/* Meta */}
      <div className="space-y-4">
        {update.caption && (
          <p className="text-base leading-relaxed">{update.caption}</p>
        )}

        <div className="flex items-center gap-3">
          {update.artist_avatar_url && (
            <div className="relative w-8 h-8 shrink-0 border border-black overflow-hidden">
              <Image
                src={update.artist_avatar_url}
                alt={name}
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
          )}
          <div>
            <Link
              href={`/${update.artist_username}`}
              className="text-sm font-semibold hover:underline underline-offset-2"
            >
              {name}
            </Link>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
