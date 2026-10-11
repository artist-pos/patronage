import { ListingUiShell } from "@/components/accessibility/ListingUiShell";

// Every organiser screen: the listing wizards, a call's management pages, the roster.
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <ListingUiShell>{children}</ListingUiShell>;
}
