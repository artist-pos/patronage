import type { Metadata } from "next";
import { getServerUser } from "@/lib/supabase/get-server-user";
import { isAdmin } from "@/lib/admin";
import { getAppreciatedNoteIds, getSpaceNotes, readDeviceId, voterKey } from "@/lib/space-board";
import { SpaceBoard } from "@/components/space/SpaceBoard";
import "../here-together.css";

// The Here Together pinboard, linked from an Instagram story. Public and
// phone-first. Says nothing about the building, the landlord or any terms:
// "a space in Auckland CBD" only. Appreciation counts are public here by
// explicit exception (migration 228, CLAUDE.md).
export const dynamic = "force-dynamic";

const QUESTION = "What do you want out of a creative space?";

export const metadata: Metadata = {
  title: `${QUESTION} | Here Together`,
  description: "We've been offered a space in Auckland CBD. Leave a note on the board and tell us what you'd want from it.",
  robots: { index: false, follow: false },
  openGraph: {
    title: `Here Together: ${QUESTION}`,
    description: "We've been offered a space in Auckland CBD. Leave a note on the board.",
    images: [],
  },
};

export default async function HereTogetherSpacePage() {
  const { supabase, user } = await getServerUser();
  const admin = user ? await isAdmin() : false;
  const [notes, deviceId] = await Promise.all([getSpaceNotes(supabase, admin), readDeviceId()]);
  const appreciated = await getAppreciatedNoteIds(
    voterKey(user?.id ?? null, user ? null : deviceId),
    notes.map((n) => n.id),
  );

  let defaultName = "";
  if (user) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    defaultName = data?.full_name ?? "";
  }

  return (
    <main className="ht min-h-screen">
      <div className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
        <header className="max-w-3xl">
          <p className="ht-wordmark" style={{ fontSize: "clamp(2.75rem, 9vw, 112px)" }}>Here Together</p>
          <p className="mt-8 text-[16px] leading-[1.55] text-[#57534e] sm:mt-10 sm:text-[17px]">
            We&rsquo;ve been offered a space in Auckland CBD.
          </p>
          <h1 className="mt-2 text-[1.75rem] font-medium leading-[1.12] tracking-[-0.025em] sm:text-[2.6rem]">
            {QUESTION}
          </h1>
        </header>

        <SpaceBoard
          initialNotes={notes}
          initialAppreciated={appreciated}
          defaultName={defaultName}
          isAdmin={admin}
        />
      </div>
    </main>
  );
}
