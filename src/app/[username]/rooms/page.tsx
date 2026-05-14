import { redirect, notFound } from "next/navigation";
import { getProfile } from "@/lib/profiles";

interface Props {
  params: Promise<{ username: string }>;
}

export default async function RoomsIndexPage({ params }: Props) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();
  redirect(`/${username}`);
}
