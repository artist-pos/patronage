import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmailCapture } from "@/components/home/EmailCapture";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-6">
      <div className="max-w-xl w-full space-y-12">
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight">Patronage</h1>
            <p className="text-lg text-muted-foreground">
              Grants, residencies, and open calls for New Zealand and Australian
              artists — curated and verified.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/opportunities">Browse Opportunities</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/artists">Join as Artist</Link>
            </Button>
          </div>
        </div>

        <div className="border-t border-border pt-10">
          <EmailCapture />
        </div>
      </div>
    </div>
  );
}
