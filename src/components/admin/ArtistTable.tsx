"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  toggleArtistActive,
  togglePatronageSupported,
  deleteArtist,
} from "@/app/admin/artists/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Profile } from "@/types/database";

export function ArtistTable({ artists }: { artists: Profile[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  function act(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-3 pr-4 font-medium text-muted-foreground w-40">Username</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Name</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Country</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Stage</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Active</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Supported</th>
              <th className="py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {artists.map((a) => (
              <tr key={a.id} className="border-b border-border group">
                <td className="py-3 pr-4 font-mono">
                  <a
                    href={`/${a.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {a.username}
                  </a>
                </td>
                <td className="py-3 pr-4 text-muted-foreground">{a.full_name ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{a.country ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{a.career_stage ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant={a.is_active ? "outline" : "default"}
                    disabled={isPending}
                    onClick={() => act(() => toggleArtistActive(a.id, a.is_active))}
                    className="text-xs h-7 px-2"
                  >
                    {a.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </td>
                <td className="py-3 pr-4">
                  <Button
                    size="sm"
                    variant={a.is_patronage_supported ? "default" : "outline"}
                    disabled={isPending}
                    onClick={() =>
                      act(() => togglePatronageSupported(a.id, a.is_patronage_supported))
                    }
                    className="text-xs h-7 px-2"
                  >
                    {a.is_patronage_supported ? "Supported ✓" : "Mark supported"}
                  </Button>
                </td>
                <td className="py-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setDeleteTarget(a)}
                    className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {artists.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No artists yet.
          </p>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete artist</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <strong>{deleteTarget?.username}</strong>? This removes their
              profile and all portfolio images. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={isPending}
              onClick={() => {
                if (!deleteTarget) return;
                const id = deleteTarget.id;
                setDeleteTarget(null);
                act(() => deleteArtist(id));
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
