import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getProfile, getPortfolioImages } from "@/lib/profiles";
import { Badge } from "@/components/ui/badge";

interface Props {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Artist not found — Patronage" };
  return {
    title: `${profile.full_name ?? profile.username} — Patronage`,
    description: profile.bio ?? undefined,
  };
}

export default async function ArtistProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const images = await getPortfolioImages(profile.id);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <div className="flex items-start gap-6">
        {profile.avatar_url && (
          <div className="relative w-20 h-20 shrink-0 border border-border overflow-hidden">
            <Image
              src={profile.avatar_url}
              alt={profile.full_name ?? profile.username}
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        )}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.full_name ?? profile.username}
            </h1>
            {profile.is_patronage_supported && (
              <Badge className="text-xs font-normal bg-foreground text-background">
                Patronage Supported
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          <div className="flex flex-wrap gap-2">
            {profile.country && (
              <Badge variant="outline" className="text-xs font-normal">
                {profile.country}
              </Badge>
            )}
            {profile.career_stage && (
              <Badge variant="outline" className="text-xs font-normal">
                {profile.career_stage}
              </Badge>
            )}
            {(profile.medium ?? []).map((m) => (
              <Badge key={m} variant="outline" className="text-xs font-normal">
                {m}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <section>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
        </section>
      )}

      {/* Portfolio */}
      {images.length > 0 && (
        <section className="space-y-4 border-t border-border pt-10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Portfolio
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="relative aspect-square border border-border overflow-hidden"
              >
                <Image
                  src={img.url}
                  alt="Portfolio work"
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CV */}
      {profile.cv_url && (
        <section className="border-t border-border pt-10">
          <a
            href={profile.cv_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-2 hover:text-muted-foreground transition-colors"
          >
            Download CV (PDF) →
          </a>
        </section>
      )}

      <div className="border-t border-border pt-6">
        <Link
          href="/artists"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to artists
        </Link>
      </div>
    </div>
  );
}
