import { getCRMContacts } from "./actions";
import { CRMClient } from "./CRMClient";

export default async function CRMPage() {
  const contacts = await getCRMContacts();

  return (
    <div className="max-w-[1600px] space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">CRM</h1>
        <p className="text-xs text-muted-foreground">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""} — track outreach to companies, councils, arts orgs, investors, and media.
        </p>
      </div>

      <CRMClient initialContacts={contacts} />
    </div>
  );
}
