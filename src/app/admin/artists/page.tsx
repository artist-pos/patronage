import { getAllProfiles } from "@/lib/admin";
import { ArtistTable } from "@/components/admin/ArtistTable";

export const metadata = { title: "Artists — Admin — Patronage" };

export default async function AdminArtistsPage() {
  const artists = await getAllProfiles();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Artists</h1>
        <p className="text-xs text-muted-foreground">
          {artists.length} total · Toggle active status or Patronage Supported
          badge · Delete permanently removes the profile and portfolio.
        </p>
      </div>
      <ArtistTable artists={artists} />
    </div>
  );
}
