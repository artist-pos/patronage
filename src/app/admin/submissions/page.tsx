import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import Image from "next/image";
import { SubmissionActions } from "./SubmissionActions";

interface Submission {
  id: string;
  title: string;
  organiser: string;
  caption: string | null;
  full_description: string | null;
  type: string;
  country: string;
  city: string | null;
  deadline: string | null;
  url: string | null;
  funding_amount: number | null;
  funding_range: string | null;
  featured_image_url: string | null;
  grant_type: string | null;
  recipients_count: number | null;
  submitter_email: string | null;
  status: string;
  created_at: string;
}

export const metadata = { title: "Submissions — Admin — Patronage" };

export default async function AdminSubmissionsPage() {
  if (!(await isAdmin())) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("opportunity_submissions")
    .select("*")
    .order("created_at", { ascending: false });

  const submissions = (data ?? []) as Submission[];
  const pending = submissions.filter((s) => s.status === "pending");
  const reviewed = submissions.filter((s) => s.status !== "pending");

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Submissions</h1>
        <p className="text-xs text-muted-foreground">
          {pending.length} pending · {reviewed.length} reviewed
        </p>
      </div>

      {pending.length === 0 && (
        <p className="text-sm text-muted-foreground border-t border-border pt-8">
          No pending submissions.
        </p>
      )}

      {pending.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground border-t border-border pt-6">
            Pending ({pending.length})
          </h2>
          <div className="space-y-6">
            {pending.map((sub) => (
              <SubmissionCard key={sub.id} sub={sub} />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground border-t border-border pt-6">
            Reviewed ({reviewed.length})
          </h2>
          <div className="space-y-4">
            {reviewed.map((sub) => (
              <div key={sub.id} className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <p className="text-sm font-semibold">{sub.title}</p>
                  <p className="text-xs text-muted-foreground">{sub.organiser}</p>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 border ${sub.status === "approved" ? "border-black" : "border-muted-foreground text-muted-foreground"}`}>
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SubmissionCard({ sub }: { sub: Submission }) {
  return (
    <div className="border border-black p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="font-semibold">{sub.title}</p>
          <p className="text-xs text-muted-foreground">{sub.organiser}</p>
          {sub.submitter_email && (
            <p className="text-xs text-muted-foreground">{sub.submitter_email}</p>
          )}
        </div>
        <SubmissionActions id={sub.id} />
      </div>

      {sub.featured_image_url && (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-neutral-100 border border-black">
          <Image
            src={sub.featured_image_url}
            alt={sub.title}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 900px) 100vw, 800px"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <Kv label="Type" value={sub.type} />
        <Kv label="Country" value={sub.country} />
        <Kv label="Deadline" value={sub.deadline ?? "Open"} />
        {sub.funding_range
          ? <Kv label="Funding" value={sub.funding_range} />
          : sub.funding_amount
          ? <Kv label="Funding" value={`$${sub.funding_amount.toLocaleString()}`} />
          : null}
      </div>

      {sub.caption && (
        <p className="text-xs text-muted-foreground leading-relaxed font-medium">{sub.caption}</p>
      )}
      {sub.full_description && (
        <p className="text-xs text-muted-foreground leading-relaxed">{sub.full_description}</p>
      )}

      {sub.url && (
        <a
          href={sub.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline underline-offset-2"
        >
          {sub.url}
        </a>
      )}
    </div>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground uppercase tracking-widest text-[10px]">{label}</p>
      <p className="font-mono">{value}</p>
    </div>
  );
}
