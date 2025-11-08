import { useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { toast } from "sonner";

import { API_BASE_URL, apiFetch } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Select } from "../../components/ui/select";

const datasets = [
  { id: "clients", label: "Clients", importable: true },
  { id: "employees", label: "Employees", importable: true },
  { id: "expenses", label: "Expenses", importable: true },
  { id: "invoices", label: "Invoices (export only)", importable: false }
] as const;

type DatasetId = (typeof datasets)[number]["id"];
type ImportableDatasetId = Extract<DatasetId, "clients" | "employees" | "expenses">;

interface ImportResult {
  data: {
    entity: ImportableDatasetId;
    inserted: number;
    updated: number;
  };
}

interface RestoreResult {
  data: {
    restored: boolean;
    bytes: number;
  };
}

export default function DataIoPage() {
  const [entity, setEntity] = useState<DatasetId>("clients");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [importStats, setImportStats] = useState<{ inserted: number; updated: number } | null>(null);
  const [restoreInfo, setRestoreInfo] = useState<{ bytes: number } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const selectedDataset = useMemo(() => datasets.find((dataset) => dataset.id === entity), [entity]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/data/export?entity=${entity}`);
      if (!response.ok) {
        throw new Error("Unable to export CSV");
      }
      await triggerDownload(response, `taxman-${entity}.csv`);
      toast.success(`Exported ${selectedDataset?.label ?? entity}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = "";

    if (!selectedDataset?.importable) {
      toast.error("This dataset is export-only");
      return;
    }

    setIsImporting(true);
    setImportStats(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        throw new Error("CSV did not contain any rows");
      }

      const response = await apiFetch<ImportResult>("/data/import", {
        method: "POST",
        body: {
          entity: entity as ImportableDatasetId,
          rows
        }
      });

      setImportStats({
        inserted: response.data.inserted,
        updated: response.data.updated
      });

      toast.success(
        `Imported ${response.data.inserted} new + ${response.data.updated} updated ${selectedDataset.label.toLowerCase()}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBackupDownload = async () => {
    setIsBackingUp(true);
    try {
      const response = await fetch(`${API_BASE_URL}/data/backup`);
      if (!response.ok) {
        throw new Error("Unable to download backup");
      }
      await triggerDownload(response, `taxman-backup.sqlite`);
      toast.success("Backup downloaded");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backup failed";
      toast.error(message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = "";
    setIsRestoring(true);

    try {
      const base64 = await fileToBase64(file);
      const response = await apiFetch<RestoreResult>("/data/restore", {
        method: "POST",
        body: {
          fileBase64: base64,
          filename: file.name
        }
      });

      setRestoreInfo({ bytes: response.data.bytes });
      toast.success("Database restored. Restart the backend to load the new data.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restore failed";
      toast.error(message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CSV Import/Export</CardTitle>
          <CardDescription>Round-trip masters and transactions via CSV for audits or offline edits.</CardDescription>
        </CardHeader>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Dataset</Label>
            <Select value={entity} onChange={(event) => setEntity(event.target.value as DatasetId)}>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">
              {selectedDataset?.importable ? "Import + export supported." : "Export only (read-only data)."}
            </p>
          </div>
          <div className="space-y-3 md:col-span-2">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? "Exporting…" : "Download CSV"}
              </Button>
              {selectedDataset?.importable && (
                <>
                  <input
                    ref={importInputRef}
                    type="file"
                    className="hidden"
                    accept=".csv,text/csv"
                    onChange={handleImportFile}
                    disabled={isImporting}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? "Importing…" : "Import CSV"}
                  </Button>
                </>
              )}
            </div>
            {importStats && (
              <p className="text-sm text-slate-600">
                Imported {importStats.inserted} new / updated {importStats.updated}. Existing IDs were updated, others
                were inserted.
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SQLite Backup & Restore</CardTitle>
          <CardDescription>
            Grab the on-disk database or restore from a previous copy. Restoring overwrites current data.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-2">
            <Button onClick={handleBackupDownload} disabled={isBackingUp}>
              {isBackingUp ? "Preparing…" : "Download Backup"}
            </Button>
            <div>
              <input
                ref={restoreInputRef}
                type="file"
                className="hidden"
                accept=".sqlite,.db,application/octet-stream"
                onChange={handleRestoreFile}
                disabled={isRestoring}
              />
              <Button
                variant="outline"
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                disabled={isRestoring}
              >
                {isRestoring ? "Restoring…" : "Restore Backup"}
              </Button>
            </div>
          </div>
          {restoreInfo && (
            <p className="text-sm text-slate-600">
              Restored file size: {(restoreInfo.bytes / 1024).toFixed(1)} KB. Restart backend to use the new data.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  const pushField = (field: string, row: string[]) => {
    row.push(field);
    return "";
  };
  const pushRow = (row: string[]) => {
    rows.push(row.slice());
    row.length = 0;
  };

  const rowBuffer: string[] = [];
  const data = input.replace(/\r\n/g, "\n");

  for (let i = 0; i < data.length; i += 1) {
    const char = data[i];

    if (inQuotes) {
      if (char === '"') {
        if (data[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      current = pushField(current, rowBuffer);
    } else if (char === "\n") {
      current = pushField(current, rowBuffer);
      pushRow(rowBuffer);
    } else {
      current += char;
    }
  }

  pushField(current, rowBuffer);
  if (rowBuffer.length > 0) {
    pushRow(rowBuffer);
  }

  if (rows.length === 0) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, "").trim());

  return dataRows
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!header) {
          return;
        }
        record[header] = row[index] ?? "";
      });
      return record;
    })
    .filter((record) => Object.values(record).some((value) => value.trim().length > 0));
}

async function triggerDownload(response: Response, fallback: string) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const contentDisposition = response.headers.get("content-disposition");
  const filename = extractFilename(contentDisposition) ?? fallback;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function extractFilename(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const match = /filename="?(?<filename>[^"]+)"?/i.exec(header);
  return match?.groups?.filename ?? null;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}
