import { Button } from "@/components/ui/button";

interface PartnerCTAProps {
  label: string;
  subject: string;
  body?: string;
}

export function PartnerCTA({ label, subject, body }: PartnerCTAProps) {
  const mailto = `mailto:hello@patronage.nz?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;

  return (
    <Button asChild>
      <a href={mailto}>{label}</a>
    </Button>
  );
}
