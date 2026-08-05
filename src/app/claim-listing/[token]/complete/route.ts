import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimListing } from "../actions";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { token } = await params;
  const url = new URL(request.url);
  const claimPageUrl = new URL(`/claim-listing/${token}`, url.origin);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(claimPageUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "partner") {
    return NextResponse.redirect(claimPageUrl);
  }

  const result = await claimListing(token, user.id);
  if ("error" in result) {
    return NextResponse.redirect(claimPageUrl);
  }

  return NextResponse.redirect(
    new URL(`/partner/opportunities/${result.id}/edit`, url.origin)
  );
}
