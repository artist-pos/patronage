import { redirect } from "next/navigation";

export default function ProfileNotesPage() {
  redirect("/studio?section=feed&ft=notes");
}
