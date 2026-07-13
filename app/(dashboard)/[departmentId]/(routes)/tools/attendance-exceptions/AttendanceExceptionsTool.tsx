"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  ATTENDANCE_EXCEPTION_STATUS_LABELS,
  ATTENDANCE_EXCEPTION_STATUSES,
  ATTENDANCE_EXCEPTION_TYPE_LABELS,
  ATTENDANCE_EXCEPTION_TYPES,
  HABITUAL_TARDINESS_LATE_DAY_THRESHOLD,
  buildAnnex8cSummary,
  normalizeBioNo,
  parsePerDayMatrix,
  parseSummaryMatrix,
  perDayToAutoExceptionDrafts,
  type AttendanceExceptionStatusCode,
  type AttendanceExceptionTypeCode,
} from "@/lib/attendance-exception";
import { cn } from "@/lib/utils";

import { exportAnnex8cExcel } from "./annex8c-export";

type ExceptionRow = {
  id: string;
  employeeId: string | null;
  employeeNo: string;
  employeeName: string;
  officeName: string;
  incidentDate: string;
  incidentDates?: string;
  exceptionType: AttendanceExceptionTypeCode;
  occurrences: number;
  actionTaken: string;
  status: AttendanceExceptionStatusCode;
  remarks: string;
  reportingPeriod: string;
  source: "auto" | "manual";
};

type Option = { id: string; name: string; employeeNo?: string; officeName?: string };

const MANUAL_TYPES = ["MD", "FD", "UA", "AWOL"] as const;

function tuMinStorageKey(departmentId: string) {
  return `annex8c-tu-min-filter:${departmentId}`;
}

export default function AttendanceExceptionsTool({ departmentId }: { departmentId: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [reportingPeriod, setReportingPeriod] = useState<string>("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  /** Default on: hide T/U rows below the threshold (habitual-style focus). */
  const [filterTuByMin, setFilterTuByMin] = useState(true);
  const [tuMinOccurrences, setTuMinOccurrences] = useState(HABITUAL_TARDINESS_LATE_DAY_THRESHOLD);
  const [addOpen, setAddOpen] = useState(false);
  const [employeeOptions, setEmployeeOptions] = useState<Option[]>([]);
  const [manualDraft, setManualDraft] = useState({
    employeeId: "",
    employeeName: "",
    officeName: "",
    employeeNo: "",
    incidentDate: "",
    exceptionType: "MD" as (typeof MANUAL_TYPES)[number],
    remarks: "",
  });
  const [isSavingManual, setIsSavingManual] = useState(false);

  const load = useCallback(
    async (period?: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (period) params.set("reportingPeriod", period);
        const res = await fetch(`/api/${departmentId}/attendance-exceptions?${params}`);
        if (!res.ok) throw new Error("Failed to load registry");
        const data = await res.json();
        setRows(data.rows ?? []);
        setPeriods(data.reportingPeriods ?? []);
        if (period) setReportingPeriod(period);
        else if (data.reportingPeriods?.[0]) setReportingPeriod(data.reportingPeriods[0]);
      } catch (err: any) {
        toast({ title: "Failed to load", description: err?.message ?? "Unknown error", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [departmentId, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(tuMinStorageKey(departmentId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { enabled?: boolean; min?: number };
      if (typeof parsed.enabled === "boolean") setFilterTuByMin(parsed.enabled);
      if (typeof parsed.min === "number" && parsed.min >= 1) setTuMinOccurrences(parsed.min);
    } catch {
      /* ignore */
    }
  }, [departmentId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        tuMinStorageKey(departmentId),
        JSON.stringify({ enabled: filterTuByMin, min: tuMinOccurrences })
      );
    } catch {
      /* ignore */
    }
  }, [departmentId, filterTuByMin, tuMinOccurrences]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/${departmentId}/employees/simple`);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.employees ?? [];
        if (!cancelled) {
          setEmployeeOptions(
            list.map((e: any) => ({
              id: e.id,
              name: e.name || [e.lastName, e.firstName].filter(Boolean).join(", ") || e.id,
              employeeNo: e.employeeNo ?? "",
              officeName: e.offices?.name ?? e.officeName ?? "",
            }))
          );
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  const thresholdRows = useMemo(() => {
    if (!filterTuByMin) return rows;
    const min = Math.max(1, tuMinOccurrences || HABITUAL_TARDINESS_LATE_DAY_THRESHOLD);
    return rows.filter((r) => {
      if (r.exceptionType === "T" || r.exceptionType === "U") return r.occurrences >= min;
      return true; // MD / FD / UA / AWOL always shown
    });
  }, [rows, filterTuByMin, tuMinOccurrences]);

  const summary = useMemo(
    () =>
      buildAnnex8cSummary(
        thresholdRows.map((r) => ({
          employeeName: r.employeeName,
          employeeNo: r.employeeNo,
          exceptionType: r.exceptionType,
          incidentDate: r.incidentDate,
          incidentDates: r.incidentDates,
          occurrences: r.occurrences,
        }))
      ),
    [thresholdRows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return thresholdRows.filter((r) => {
      if (typeFilter !== "__all__" && r.exceptionType !== typeFilter) return false;
      if (!q) return true;
      return (
        r.employeeName.toLowerCase().includes(q) ||
        r.officeName.toLowerCase().includes(q) ||
        r.employeeNo.toLowerCase().includes(q) ||
        r.exceptionType.toLowerCase().includes(q) ||
        r.actionTaken.toLowerCase().includes(q) ||
        r.remarks.toLowerCase().includes(q)
      );
    });
  }, [thresholdRows, search, typeFilter]);

  const processFile = useCallback(
    async (file: File) => {
      const name = file.name.toLowerCase();
      if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
        toast({ title: "Invalid file", description: "Upload a biometrics export (.xlsx / .xls).", variant: "destructive" });
        return;
      }
      setIsImporting(true);
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const summarySheetName =
          wb.SheetNames.find((n) => n.toLowerCase() === "summary") ??
          wb.SheetNames.find((n) => /summary/i.test(n));
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase() === "perday") ??
          wb.SheetNames.find((n) => /per\s*day/i.test(n));
        if (!summarySheetName) {
          throw new Error('Workbook must include a "Summary" sheet (filtered employee list by bio / Employee No).');
        }
        if (!sheetName) throw new Error('Workbook must include a "PerDay" sheet.');

        const summaryMatrix = XLSX.utils.sheet_to_json(wb.Sheets[summarySheetName], {
          header: 1,
          defval: "",
        }) as unknown[][];
        const summaryEmployees = parseSummaryMatrix(summaryMatrix);
        if (!summaryEmployees.length) {
          throw new Error("Summary sheet has no employees. Export the filtered monthly Summary again.");
        }

        const allowedBios = new Set(summaryEmployees.map((e) => normalizeBioNo(e.employeeNo).toLowerCase()));
        const summaryByBio = new Map(
          summaryEmployees.map((e) => [
            normalizeBioNo(e.employeeNo).toLowerCase(),
            { employeeName: e.employeeName, officeName: e.officeName },
          ])
        );

        const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" }) as unknown[][];
        const perDay = parsePerDayMatrix(matrix);
        if (!perDay.length) throw new Error("No usable PerDay rows found.");
        const { reportingPeriod, drafts } = perDayToAutoExceptionDrafts(perDay, {
          allowedEmployeeNos: allowedBios,
          summaryByBio,
        });
        if (!drafts.length) {
          toast({
            title: "No T/U rows",
            description: `Summary has ${summaryEmployees.length} employees, but none had Late/Undertime in PerDay for those bio numbers.`,
          });
          return;
        }
        const res = await fetch(`/api/${departmentId}/attendance-exceptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportingPeriod, drafts }),
        });
        if (!res.ok) throw new Error("Import failed");
        const data = await res.json();
        setRows(data.rows ?? []);
        setReportingPeriod(data.reportingPeriod);
        setPeriods((prev) =>
          prev.includes(data.reportingPeriod) ? prev : [data.reportingPeriod, ...prev]
        );
        toast({
          title: "Import complete",
          description: `${data.created} T/U row(s) from ${summaryEmployees.length} Summary employees (bio-matched). Manual MD/FD/UA/AWOL kept.`,
        });
      } catch (err: any) {
        toast({ title: "Import failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [departmentId, toast]
  );

  const patchRow = useCallback(
    async (id: string, patch: Partial<Pick<ExceptionRow, "actionTaken" | "status" | "remarks">>) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      try {
        const res = await fetch(`/api/${departmentId}/attendance-exceptions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Save failed");
      } catch (err: any) {
        toast({ title: "Failed to save", description: err?.message ?? "Unknown error", variant: "destructive" });
        await load(reportingPeriod || undefined);
      }
    },
    [departmentId, load, reportingPeriod, toast]
  );

  const deleteRow = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/${departmentId}/attendance-exceptions/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Delete failed");
        setRows((prev) => prev.filter((r) => r.id !== id));
      } catch (err: any) {
        toast({ title: "Failed to delete", description: err?.message ?? "Unknown error", variant: "destructive" });
      }
    },
    [departmentId, toast]
  );

  const saveManual = useCallback(async () => {
    if (!reportingPeriod) {
      toast({ title: "Pick a reporting period", description: "Import a PerDay file first, or type a period label.", variant: "destructive" });
      return;
    }
    if (!manualDraft.employeeName.trim() || !manualDraft.incidentDate) {
      toast({ title: "Missing fields", description: "Employee name and incident date are required.", variant: "destructive" });
      return;
    }
    setIsSavingManual(true);
    try {
      const res = await fetch(`/api/${departmentId}/attendance-exceptions/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportingPeriod,
          employeeId: manualDraft.employeeId || null,
          employeeNo: manualDraft.employeeNo,
          employeeName: manualDraft.employeeName,
          officeName: manualDraft.officeName,
          incidentDate: manualDraft.incidentDate,
          exceptionType: manualDraft.exceptionType,
          remarks: manualDraft.remarks,
        }),
      });
      if (!res.ok) throw new Error("Failed to add row");
      setAddOpen(false);
      setManualDraft({
        employeeId: "",
        employeeName: "",
        officeName: "",
        employeeNo: "",
        incidentDate: "",
        exceptionType: "MD",
        remarks: "",
      });
      await load(reportingPeriod);
      toast({ title: "Exception added" });
    } catch (err: any) {
      toast({ title: "Failed to add", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setIsSavingManual(false);
    }
  }, [departmentId, load, manualDraft, reportingPeriod, toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Annex 8-C: Attendance Exception Registry</h2>
          <p className="text-sm text-muted-foreground">
            Import the monthly biometrics file (Summary + PerDay). Auto T/U uses Summary employees only (by bio number), with
            dates from PerDay. Add MD / FD / UA / AWOL manually. Saved to a separate table — live HR data untouched.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAddOpen(true)} disabled={!reportingPeriod}>
            Add MD/FD/UA/AWOL
          </Button>
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() => {
              void exportAnnex8cExcel(
                filtered.map((r) => ({
                  employeeName: r.employeeName,
                  officeName: r.officeName,
                  incidentDate: r.incidentDates?.trim() || r.incidentDate,
                  exceptionType: r.exceptionType,
                  occurrences: r.occurrences,
                  actionTaken: r.actionTaken,
                  status: r.status,
                  remarks: r.remarks,
                  employeeNo: r.employeeNo,
                  incidentDates: r.incidentDates,
                })),
                reportingPeriod || "period"
              );
            }}
          >
            Export to Excel
          </Button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!isImporting) fileInputRef.current?.click();
          }
        }}
        onClick={() => !isImporting && fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void processFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
          isDragOver ? "border-indigo-500 bg-indigo-50" : "border-muted-foreground/25 hover:bg-muted/30",
          isImporting && "pointer-events-none opacity-70"
        )}
      >
        {isImporting ? <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /> : <Upload className="h-7 w-7 text-muted-foreground" />}
        <p className="text-sm font-medium">{isImporting ? "Importing…" : "Drag & drop biometrics export (.xlsx)"}</p>
        <p className="text-xs text-muted-foreground">
          Needs Summary + PerDay sheets · T/U only for Summary bio numbers
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void processFile(file);
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-sm text-muted-foreground">Reporting period</Label>
        <Select
          value={reportingPeriod || undefined}
          onValueChange={(v) => {
            setReportingPeriod(v);
            void load(v);
          }}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!periods.length ? (
          <Input
            className="w-[280px]"
            placeholder="Or type a period label for manual rows"
            value={reportingPeriod}
            onChange={(e) => setReportingPeriod(e.target.value)}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Employees with exceptions", summary.employeesWithExceptions],
          ["Tardiness incidents", summary.tardinessIncidents],
          ["Undertime incidents", summary.undertimeIncidents],
          ["Missing DTR (MD)", summary.missingDtrIncidents],
          ["Unauthorized absences (UA)", summary.unauthorizedAbsences],
          ["AWOL cases", summary.awolCases],
          ["Habitual tardiness cases", summary.habitualTardinessCases],
          ["Failure to submit DTR (FD)", summary.failureToSubmitDtr],
        ].map(([label, value]) => (
          <Card key={label as string}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{value as number}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Definition of Habitual Tardiness</CardTitle>
          <CardDescription>
            An employee may be considered habitually tardy based on applicable CSC rules and regulations. HRMO shall periodically review
            attendance records. Helper threshold used here: ≥ {HABITUAL_TARDINESS_LATE_DAY_THRESHOLD} late days in the reporting period.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Input
          className="max-w-md"
          placeholder="Search employee, office, remarks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <Switch id="tu-min-filter" checked={filterTuByMin} onCheckedChange={setFilterTuByMin} />
            <Label htmlFor="tu-min-filter" className="cursor-pointer text-sm font-normal leading-snug">
              T/U only if Occ. ≥
            </Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-16"
              value={tuMinOccurrences}
              disabled={!filterTuByMin}
              onChange={(e) => {
                const n = Number(e.target.value);
                setTuMinOccurrences(Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
              }}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All types</SelectItem>
              {ATTENDANCE_EXCEPTION_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t} — {ATTENDANCE_EXCEPTION_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registry</CardTitle>
          <CardDescription>
            Showing {filtered.length} of {rows.length} row{rows.length === 1 ? "" : "s"}
            {filterTuByMin
              ? ` · T/U hidden when Occ. < ${tuMinOccurrences} (MD/FD/UA/AWOL always shown)`
              : ""}
            {isLoading ? " · Loading…" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-20 text-center">Occ.</TableHead>
                  <TableHead>Action Taken</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                      {isLoading ? "Loading…" : "No rows yet. Upload a PerDay export or add MD/FD/UA/AWOL manually."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium">{r.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{r.employeeNo || "—"}</div>
                      </TableCell>
                      <TableCell>{r.officeName || "—"}</TableCell>
                      <TableCell className="max-w-[220px] whitespace-normal text-xs leading-snug">
                        {r.incidentDates?.trim() || r.incidentDate}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" title={ATTENDANCE_EXCEPTION_TYPE_LABELS[r.exceptionType]}>
                          {r.exceptionType}
                        </Badge>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{r.source}</div>
                      </TableCell>
                      <TableCell className="text-center">{r.occurrences}</TableCell>
                      <TableCell>
                        <Input
                          className="min-w-[140px]"
                          value={r.actionTaken}
                          onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, actionTaken: e.target.value } : x)))}
                          onBlur={(e) => void patchRow(r.id, { actionTaken: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(v) => void patchRow(r.id, { status: v as AttendanceExceptionStatusCode })}
                        >
                          <SelectTrigger className="min-w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTENDANCE_EXCEPTION_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {ATTENDANCE_EXCEPTION_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="min-w-[140px]"
                          value={r.remarks}
                          onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, remarks: e.target.value } : x)))}
                          onBlur={(e) => void patchRow(r.id, { remarks: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" onClick={() => void deleteRow(r.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type of Attendance Exception Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {ATTENDANCE_EXCEPTION_TYPES.map((t) => (
                  <TableRow key={t}>
                    <TableCell className="w-16 font-semibold">{t}</TableCell>
                    <TableCell>{ATTENDANCE_EXCEPTION_TYPE_LABELS[t]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {ATTENDANCE_EXCEPTION_STATUSES.map((s) => (
                  <TableRow key={s}>
                    <TableCell className="font-semibold">{ATTENDANCE_EXCEPTION_STATUS_LABELS[s]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add attendance exception</DialogTitle>
            <DialogDescription>Use for MD, FD, UA, or AWOL (not auto-filled from PerDay).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Employee</Label>
              <Select
                value={manualDraft.employeeId || "__custom__"}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    setManualDraft((d) => ({ ...d, employeeId: "", employeeName: "", employeeNo: "", officeName: "" }));
                    return;
                  }
                  const opt = employeeOptions.find((o) => o.id === v);
                  setManualDraft((d) => ({
                    ...d,
                    employeeId: v,
                    employeeName: opt?.name ?? d.employeeName,
                    employeeNo: opt?.employeeNo ?? "",
                    officeName: opt?.officeName ?? "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">Custom name…</SelectItem>
                  {employeeOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Employee name</Label>
              <Input
                value={manualDraft.employeeName}
                onChange={(e) => setManualDraft((d) => ({ ...d, employeeName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Office</Label>
                <Input value={manualDraft.officeName} onChange={(e) => setManualDraft((d) => ({ ...d, officeName: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Incident date</Label>
                <Input
                  type="date"
                  value={manualDraft.incidentDate}
                  onChange={(e) => setManualDraft((d) => ({ ...d, incidentDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={manualDraft.exceptionType}
                onValueChange={(v) => setManualDraft((d) => ({ ...d, exceptionType: v as (typeof MANUAL_TYPES)[number] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t} — {ATTENDANCE_EXCEPTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Remarks</Label>
              <Textarea value={manualDraft.remarks} onChange={(e) => setManualDraft((d) => ({ ...d, remarks: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveManual()} disabled={isSavingManual}>
              {isSavingManual ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
