import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getInviteByToken } from "@/lib/rabobank/invites";
import { COPY } from "@/lib/rabobank/artist-copy";
import { Shell } from "../Shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: COPY.meta.title, robots: { index: false, follow: false }, openGraph: { title: COPY.meta.title, images: [] } };

export default async function ThanksPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await getInviteByToken(token))) notFound();
  return (
    <Shell>
      <div className="space-y-5">
        <h1 className="text-4xl font-light tracking-tight">{COPY.thanks.heading}</h1>
        <p className="text-lg leading-relaxed">{COPY.thanks.body}</p>
        <p className="leading-relaxed text-stone-600">{COPY.thanks.next}</p>
      </div>
      <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <p className="leading-relaxed">{COPY.thanks.partTwoWhy}</p>
        <Link href={`/partners/rabobank/artists/${token}#part-two`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-6 font-medium text-white hover:opacity-85">
          {COPY.thanks.partTwoButton}
        </Link>
      </div>
    </Shell>
  );
}
