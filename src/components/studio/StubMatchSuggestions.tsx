import Link from "next/link";
import type { PendingArtist } from "@/types/database";

interface Props {
  stubs: PendingArtist[];
}

/**
 * Surface stubs whose normalised name matches the artist's. We don't
 * auto-claim — the artist confirms manually so we never silently merge two
 * unrelated artists with the same name. Each row links to /claim/artist/[token]
 * which handles the email-verification gate and the actual repointing.
 */
export function StubMatchSuggestions({ stubs }: Props) {
  return (
    <section className="mb-8 border border-amber-200 bg-amber-50 rounded-xl p-5 space-y-3">
      <p className="text-sm font-medium text-amber-900">
        We found {stubs.length} unclaimed record{stubs.length === 1 ? "" : "s"} that might be you
      </p>
      <p className="text-xs text-amber-800 max-w-2xl">
        Holders have registered works under this name. If any of these are
        yours, click through to claim them — the works will then surface
        above for confirmation.
      </p>
      <ul className="space-y-2">
        {stubs.map((stub) => (
          <li
            key={stub.id}
            className="flex items-center justify-between gap-3 bg-white rounded-md px-3 py-2 border border-amber-100"
          >
            <div className="text-sm">
              <span className="font-medium">{stub.name}</span>
              {stub.email && (
                <span className="text-stone-500 text-xs"> · {stub.email}</span>
              )}
            </div>
            <Link
              href={`/claim/artist/${stub.claim_token}`}
              className="text-xs underline text-stone-700 hover:text-stone-900"
            >
              Review →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
