"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileArchive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type BackupManifest = {
  departmentId: string;
  departmentName: string;
  createdAt: string;
  createdBy: string;
  reason: "manual" | "pre-restore";
  counts: Record<string, number>;
  app?: {
    name?: string;
    version?: string;
    schemaHash?: string | null;
  };
};

type BackupSummary = {
  id: string;
  filename: string;
  size: number;
  modifiedAt: string;
  manifest: BackupManifest;
};

type ValidationResult = {
  manifest: BackupManifest;
  counts: Record<string, number>;
};

type RestoreTarget =
  | { type: "local"; backupId: string; label: string }
  | { type: "upload"; file: File; label: string };

type BackupRestoreClientProps = {
  departmentId: string;
};

const RESTORE_STEPS = [
  "Validating backup file",
  "Creating pre-restore safety snapshot",
  "Replacing current department records",
  "Restoring related employee records",
  "Finalizing restore",
];

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function nonZeroCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}

async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    const message =
      typeof body?.error === "string" ? body.error : "Backup request failed.";
    const details = Array.isArray(body?.details) ? ` ${body.details.join(" ")}` : "";
    throw new Error(`${message}${details}`);
  }

  return body as T;
}

export default function BackupRestoreClient({ departmentId }: BackupRestoreClientProps) {
  const [backups, setBackups] = React.useState<BackupSummary[]>([]);
  const [storageDirectory, setStorageDirectory] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [validation, setValidation] = React.useState<ValidationResult | null>(null);
  const [restoreTarget, setRestoreTarget] = React.useState<RestoreTarget | null>(null);
  const [confirmation, setConfirmation] = React.useState("");
  const [restoreStepIndex, setRestoreStepIndex] = React.useState(0);

  const backupsUrl = `/api/${departmentId}/backups`;

  const loadBackups = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiJson<{
        backups: BackupSummary[];
        storage: { directory: string };
      }>(backupsUrl);
      setBackups(data.backups);
      setStorageDirectory(data.storage.directory);
    } catch (error) {
      toast.error("Failed to load backups", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [backupsUrl]);

  React.useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  React.useEffect(() => {
    if (!restoring) {
      setRestoreStepIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setRestoreStepIndex((current) =>
        current < RESTORE_STEPS.length - 1 ? current + 1 : current
      );
    }, 1800);

    return () => window.clearInterval(interval);
  }, [restoring]);

  const createBackup = async () => {
    setCreating(true);
    try {
      const data = await apiJson<{ backup: BackupSummary }>(backupsUrl, {
        method: "POST",
      });
      setBackups((current) => [data.backup, ...current]);
      toast.success("Backup created", {
        description: data.backup.filename,
      });
    } catch (error) {
      toast.error("Backup failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const validateLocalBackup = async (backupId: string) => {
    setValidating(true);
    try {
      const data = await apiJson<ValidationResult>(`${backupsUrl}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });
      setValidation(data);
      toast.success("Backup is valid");
    } catch (error) {
      setValidation(null);
      toast.error("Validation failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setValidating(false);
    }
  };

  const validateUploadedBackup = async () => {
    if (!uploadFile) {
      toast.error("Select a ZIP file first.");
      return;
    }

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const data = await apiJson<ValidationResult>(`${backupsUrl}/validate`, {
        method: "POST",
        body: formData,
      });
      setValidation(data);
      toast.success("Uploaded backup is valid");
    } catch (error) {
      setValidation(null);
      toast.error("Validation failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setValidating(false);
    }
  };

  const downloadBackup = async (backup: BackupSummary) => {
    try {
      const response = await fetch(`${backupsUrl}/${backup.id}/download`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? "Download failed.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backup.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Download failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const openRestoreDialog = (target: RestoreTarget) => {
    setConfirmation("");
    setRestoreTarget(target);
  };

  const restoreBackup = async () => {
    if (!restoreTarget) return;

    setRestoring(true);
    setRestoreStepIndex(0);
    try {
      if (restoreTarget.type === "local") {
        await apiJson(`${backupsUrl}/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            backupId: restoreTarget.backupId,
            confirmation,
          }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", restoreTarget.file);
        formData.append("confirmation", confirmation);
        await apiJson(`${backupsUrl}/restore`, {
          method: "POST",
          body: formData,
        });
      }

      setRestoreStepIndex(RESTORE_STEPS.length - 1);
      toast.success("Restore completed", {
        description: "A pre-restore safety backup was created first.",
      });
      setRestoreTarget(null);
      setValidation(null);
      await loadBackups();
    } catch (error) {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <>
      <Alert className="border-amber-200 bg-amber-50 text-amber-950">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Private data warning</AlertTitle>
        <AlertDescription>
          Backup ZIP files are owner-only but unencrypted. They contain employee
          profile data, identifiers, contact details, and links to external assets.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Database className="h-5 w-5" />
                Local Snapshots
              </CardTitle>
              <CardDescription>
                Stored on this app machine at {storageDirectory || "backups/local"}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={loadBackups} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={createBackup} disabled={creating}>
                <FileArchive className="h-4 w-4" />
                {creating ? "Creating..." : "Create Backup"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Loading backups...
              </div>
            ) : backups.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No local snapshots yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Created</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Size</th>
                      <th className="px-3 py-2 font-medium">Records</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => {
                      const counts = nonZeroCounts(backup.manifest.counts);
                      const recordTotal = counts.reduce((sum, [, count]) => sum + count, 0);

                      return (
                        <tr key={backup.id} className="border-b last:border-0">
                          <td className="px-3 py-3">
                            <div className="font-medium">
                              {formatDate(backup.manifest.createdAt)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {backup.filename}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={
                                backup.manifest.reason === "pre-restore"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {backup.manifest.reason === "pre-restore"
                                ? "Safety"
                                : "Manual"}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">{formatBytes(backup.size)}</td>
                          <td className="px-3 py-3">{recordTotal}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => validateLocalBackup(backup.id)}
                                disabled={validating}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Validate
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadBackup(backup)}
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  openRestoreDialog({
                                    type: "local",
                                    backupId: backup.id,
                                    label: backup.filename,
                                  })
                                }
                              >
                                <RotateCcw className="h-4 w-4" />
                                Restore
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-5 w-5" />
                Upload ZIP
              </CardTitle>
              <CardDescription>
                Validate a portable backup before restoring it into this department.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="file"
                accept=".zip,application/zip"
                onChange={(event) => {
                  setUploadFile(event.target.files?.[0] ?? null);
                  setValidation(null);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={validateUploadedBackup}
                  disabled={!uploadFile || validating}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Validate Upload
                </Button>
                <Button
                  variant="destructive"
                  disabled={!uploadFile}
                  onClick={() =>
                    uploadFile &&
                    openRestoreDialog({
                      type: "upload",
                      file: uploadFile,
                      label: uploadFile.name,
                    })
                  }
                >
                  <RotateCcw className="h-4 w-4" />
                  Restore Upload
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Validation</CardTitle>
              <CardDescription>
                Latest manifest summary from a validated local or uploaded backup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {validation ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium">{validation.manifest.departmentName}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {formatDate(validation.manifest.createdAt)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {nonZeroCounts(validation.counts).map(([modelName, count]) => (
                      <Badge key={modelName} variant="outline">
                        {modelName}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
                  No validated backup selected.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={!!restoreTarget}
        onOpenChange={(open) => {
          if (!open && !restoring) {
            setRestoreTarget(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Department Backup</DialogTitle>
            <DialogDescription>
              This will create a safety backup first, then replace the current department
              records with {restoreTarget?.label}. Type RESTORE to continue.
            </DialogDescription>
          </DialogHeader>
          {restoring ? (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <Loader2 className="mt-0.5 h-5 w-5 animate-spin" />
                <div className="space-y-1">
                  <div className="text-sm font-semibold">
                    Currently restoring {restoreTarget?.label}
                  </div>
                  <div className="text-sm">
                    {RESTORE_STEPS[restoreStepIndex]}
                  </div>
                  <div className="text-xs text-amber-800">
                    Keep this tab open. The system is creating a safety backup before replacing records.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="RESTORE"
              autoComplete="off"
              disabled={restoring}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRestoreTarget(null)}
              disabled={restoring}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={restoreBackup}
              disabled={confirmation !== "RESTORE" || restoring}
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Restoring
                </>
              ) : (
                "Restore"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
