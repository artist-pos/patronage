import { CsvUploader } from "@/components/admin/CsvUploader";

export const metadata = {
  title: "Upload Opportunities — Admin — Patronage",
};

export default function AdminUploadPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <div className="space-y-1 border-b border-border pb-6">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">
          Admin
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Opportunities
        </h1>
        <p className="text-sm text-muted-foreground">
          Bulk-import listings from a CSV file. Rows with invalid data are
          rejected individually — valid rows still insert.
        </p>
      </div>
      <CsvUploader />
    </div>
  );
}
