"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  toggleOpportunityActive,
  deleteOpportunity,
} from "@/app/admin/opportunities/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Opportunity } from "@/types/database";

export function OpportunityTable({ opps }: { opps: Opportunity[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);

  const today = new Date().toISOString().split("T")[0];

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
              <th className="py-3 pr-4 font-medium text-muted-foreground">Title</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Type</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Country</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Deadline</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Status</th>
              <th className="py-3 pr-4 font-medium text-muted-foreground">Actions</th>
              <th className="py-3 font-medium text-muted-foreground">Report</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => {
              const expired = o.deadline && o.deadline < today;
              return (
                <tr key={o.id} className="border-b border-border">
                  <td className="py-3 pr-4 max-w-[220px]">
                    <span className="line-clamp-1">{o.title}</span>
                    <span className="text-muted-foreground block truncate">
                      {o.organiser}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline" className="text-xs font-normal">
                      {o.type}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{o.country}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        expired ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {o.deadline ?? "Open"}
                      {expired && " (expired)"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <Button
                      size="sm"
                      variant={o.is_active ? "outline" : "default"}
                      disabled={isPending}
                      onClick={() =>
                        act(() => toggleOpportunityActive(o.id, o.is_active))
                      }
                      className="text-xs h-7 px-2"
                    >
                      {o.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </td>
                  <td className="py-3 pr-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setDeleteTarget(o)}
                      className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/admin/opportunities/${o.id}/report`}
                      className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Report →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {opps.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No opportunities yet.
          </p>
        )}
      </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete opportunity</DialogTitle>
            <DialogDescription>
              Permanently delete{" "}
              <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong> by{" "}
              {deleteTarget?.organiser}? This cannot be undone.
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
                act(() => deleteOpportunity(id));
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
