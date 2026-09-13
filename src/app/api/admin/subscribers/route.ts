import { isAdmin } from "@/lib/admin";
import { getDigestRecipients } from "@/lib/digest-send";
import { NextResponse } from "next/server";

/**
 * CSV of everyone the digest goes to.
 *
 * Reads the same function the send does, so the export cannot describe a
 * different list from the one that actually receives mail.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const recipients = await getDigestRecipients();

  const csv = [
    "email,has_account",
    ...recipients.map((r) => `${r.email},${r.profileId ? "yes" : "no"}`),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="patronage-digest-recipients-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
