import { redirect } from "next/navigation";

export default function ProfileNotesPage() {
  redirect("/studio/feed?ft=notes");
}
