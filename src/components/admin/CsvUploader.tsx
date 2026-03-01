"use client";

import { useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { uploadCsvAction, type RowResult } from "@/app/admin/upload/actions";

const REQUIRED_COLS = ["title", "organiser", "type", "country"];
const ALL_COLS = [...REQUIRED_COLS, "description", "deadline", "url"];

export function CsvUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setResults(null);
    setParseError(null);
    setPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete(results) {
        const headers = results.meta.fields ?? [];
        const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
        if (missing.length > 0) {
          setParseError(`CSV is missing required columns: ${missing.join(", ")}`);
          return;
        }
        setPreview(results.data as Record<string, string>[]);
      },
      error(err) {
        setParseError(err.message);
      },
    });
  }

  function handleUpload() {
    if (!preview) return;
    startTransition(async () => {
      const res = await uploadCsvAction(preview);
      setResults(res);
    });
  }

  const okCount = results?.filter((r) => r.status === "ok").length ?? 0;
  const errCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Upload a <code className="font-mono text-foreground">.csv</code> file
          with the following columns (required: bold):
        </p>
        <p className="font-mono text-xs">
          {ALL_COLS.map((c) => (
            <span key={c}>
              {REQUIRED_COLS.includes(c) ? (
                <strong className="text-foreground">{c}</strong>
              ) : (
                c
              )}
              {c !== ALL_COLS.at(-1) ? ", " : ""}
            </span>
          ))}
        </p>
        <p className="text-xs">
          Valid <strong>type</strong> values: Grant, Residency, Commission, Open
          Call, Prize, Display
          <br />
          Valid <strong>country</strong> values: NZ, AUS, Global
          <br />
          <strong>deadline</strong> format: YYYY-MM-DD (leave blank for open
          deadline)
        </p>
      </div>

      {/* File input */}
      <div className="flex items-center gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="text-sm file:mr-4 file:border file:border-border file:bg-transparent file:text-sm file:px-3 file:py-1.5 file:cursor-pointer hover:file:bg-muted"
        />
        {preview && (
          <Button onClick={handleUpload} disabled={isPending}>
            {isPending ? "Uploading…" : `Upload ${preview.length} rows`}
          </Button>
        )}
      </div>

      {parseError && (
        <p className="text-sm text-destructive">{parseError}</p>
      )}

      {/* Preview table */}
      {preview && !results && (
        <div className="overflow-x-auto">
          <p className="text-xs text-muted-foreground mb-3">
            Preview — {preview.length} rows
          </p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                {ALL_COLS.map((c) => (
                  <th
                    key={c}
                    className="text-left py-2 pr-4 font-medium text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-b border-border">
                  {ALL_COLS.map((c) => (
                    <td key={c} className="py-2 pr-4 max-w-[160px] truncate">
                      {row[c] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {preview.length > 10 && (
            <p className="text-xs text-muted-foreground mt-2">
              …and {preview.length - 10} more rows
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <p className="text-sm">
            {okCount > 0 && (
              <span className="text-foreground font-medium">
                {okCount} inserted.{" "}
              </span>
            )}
            {errCount > 0 && (
              <span className="text-destructive font-medium">
                {errCount} failed.
              </span>
            )}
          </p>
          {errCount > 0 && (
            <ul className="text-xs space-y-1 text-destructive">
              {results
                .filter((r) => r.status === "error")
                .map((r) => (
                  <li key={r.row}>
                    Row {r.row} &ldquo;{r.title}&rdquo;: {r.message}
                  </li>
                ))}
            </ul>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setResults(null);
              setPreview(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Upload another file
          </Button>
        </div>
      )}
    </div>
  );
}
