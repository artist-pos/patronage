import { notFound } from "next/navigation";

// Nothing is public at the bare path; only token links work.
export default function RabobankIndex() {
  notFound();
}
