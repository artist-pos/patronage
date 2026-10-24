import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInviteByToken } from "@/lib/rabobank/invites";
import { COPY } from "@/lib/rabobank/artist-copy";
import { Shell } from "../Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: COPY.meta.title, robots: { index: false, follow: false }, openGraph: { title: COPY.meta.title, images: [] } };

export default async function DonePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ keep?: string }> }) {
  const [{ token }, { keep }] = await Promise.all([params, searchParams]);
  if (!(await getInviteByToken(token))) notFound();
  return (
    <Shell>
      <div className="space-y-5">
        <h1 className="text-4xl font-light tracking-tight">{COPY.done.heading}</h1>
        <p className="text-lg leading-relaxed">{COPY.done.body}</p>
        <p className="leading-relaxed text-stone-600">{COPY.done.next}</p>
        {keep && <p className="rounded-xl border border-stone-200 bg-white p-4 leading-relaxed">{COPY.done.keepSent}</p>}
      </div>
      <Link href={`/partners/rabobank/artists/${token}`} className="text-sm underline underline-offset-4">{COPY.landing.partsHeading}</Link>
    </Shell>
  );
}
