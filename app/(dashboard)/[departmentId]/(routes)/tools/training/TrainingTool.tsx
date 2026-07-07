"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ChevronDown, Loader2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import type { TrainingImportRow, TrainingRecord, TrainingResolvedRow, TrainingSummaryResponse } from "@/lib/training-types";
import { trainingEmployeeDisplayName } from "@/lib/training-types";

import { exportLearningDashboardExcel, exportTrainingRegistryExcel } from "./training-export";

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

// Sheet headers are matched loosely (lowercased, stripped of non-alphanumerics)
// so small typos/renames in the exported form (e.g. "Postion") don't break import.
const HEADER_ALIASES: Record<string, keyof TrainingImportRow | "timestamp" | "name"> = {
  bionumber: "bioNumberRaw",
  name: "name",
  department: "officeNameRaw",
  postion: "positionRaw",
  position: "positionRaw",
  appointment: "appointmentRaw",
  certificatetitle: "certificateTitle",
  trainingtype: "trainingType",
  provider: "provider",
  datestart: "dateStart",
  dateend: "dateEnd",
  durationhrs: "durationHours",
  duration: "durationHours",
  certificateof: "certificateOf",
  relevancetojob: "relevanceToJob",
  competencyaddressed: "competencyAddressed",
  status: "status",
  indicator: "indicator",
  remarks: "remarks",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return "";
}

function parseWorkbookRows(workbook: XLSX.WorkBook): TrainingImportRow[] {
  const sheetName = workbook.SheetNames.includes("SOURCE") ? "SOURCE" : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw
    .map((record): TrainingImportRow => {
      const row: Partial<TrainingImportRow> & { name?: string } = {};
      for (const [header, value] of Object.entries(record)) {
        const key = HEADER_ALIASES[normalizeHeader(header)];
        if (!key) continue;
        if (key === "dateStart" || key === "dateEnd") {
          row[key] = toIsoDate(value);
        } else if (key === "durationHours") {
          row.durationHours = Number(value) || 0;
        } else if (key === "name") {
          row.name = String(value ?? "");
        } else {
          (row as Record<string, unknown>)[key] = String(value ?? "");
        }
      }

      return {
        bioNumberRaw: row.bioNumberRaw ?? "",
        nameRaw: row.name ?? "",
        officeNameRaw: row.officeNameRaw ?? "",
        positionRaw: row.positionRaw ?? "",
        appointmentRaw: row.appointmentRaw ?? "",
        certificateTitle: row.certificateTitle ?? "",
        trainingType: row.trainingType ?? "",
        provider: row.provider ?? "",
        dateStart: row.dateStart ?? "",
        dateEnd: row.dateEnd ?? "",
        durationHours: row.durationHours ?? 0,
        certificateOf: row.certificateOf ?? "",
        relevanceToJob: row.relevanceToJob ?? "",
        competencyAddressed: row.competencyAddressed ?? "",
        status: row.status ?? "",
        indicator: row.indicator ?? "",
        remarks: row.remarks ?? "",
      };
    })
    // Only drop genuinely empty rows. Some source rows have a blank Bio Number
    // (a real data gap) but a real name/certificate — keep those so they show
    // up in the unmatched preview instead of silently disappearing.
    .filter((row) => row.certificateTitle.trim() !== "");
}

type Option = { id: string; name: string };

type DrilldownKey =
  | "approvedPrograms"
  | "trainingsConducted"
  | "employeesTrained"
  | "mandatoryTrainings"
  | "competencyGaps";

const DRILLDOWN_TITLES: Record<DrilldownKey, string> = {
  approvedPrograms: "Approved Training Programs",
  trainingsConducted: "Trainings Conducted",
  employeesTrained: "Employees Trained",
  mandatoryTrainings: "Mandatory Trainings Completed",
  competencyGaps: "Competency Gaps Addressed",
};

export default function TrainingTool({ departmentId }: { departmentId: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [allYears, setAllYears] = useState(false);
  const [activeTab, setActiveTab] = useState("import");

  // Exclude-employee-type filter
  const [employeeTypeOptions, setEmployeeTypeOptions] = useState<Option[]>([]);
  const [excludedTypeIds, setExcludedTypeIds] = useState<string[]>([]);
  const excludedTypesParam = useMemo(() => excludedTypeIds.join(","), [excludedTypeIds]);

  // Import state
  const [parsedRows, setParsedRows] = useState<TrainingImportRow[] | null>(null);
  const [resolvedRows, setResolvedRows] = useState<TrainingResolvedRow[] | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Registry state
  const [trainings, setTrainings] = useState<TrainingRecord[] | null>(null);
  const [isLoadingRegistry, setIsLoadingRegistry] = useState(false);

  // Dashboard state
  const [summary, setSummary] = useState<TrainingSummaryResponse | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [targetDraft, setTargetDraft] = useState<Record<string, number> | null>(null);
  const [isSavingTargets, setIsSavingTargets] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownKey | null>(null);

  const matchedCount = useMemo(() => resolvedRows?.filter((r) => r.matchStatus === "matched").length ?? 0, [resolvedRows]);
  const matchedByNameCount = useMemo(() => resolvedRows?.filter((r) => r.matchedBy === "name").length ?? 0, [resolvedRows]);
  const unmatchedRows = useMemo(() => resolvedRows?.filter((r) => r.matchStatus === "unmatched") ?? [], [resolvedRows]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsParsing(true);
      setResolvedRows(null);
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const rows = parseWorkbookRows(workbook);
        setParsedRows(rows);

        if (rows.length === 0) {
          toast({ title: "No rows found", description: "Couldn't find any training rows in this file.", variant: "destructive" });
          return;
        }

        setIsResolving(true);
        const res = await fetch(`/api/${departmentId}/training/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        if (!res.ok) throw new Error("Failed to resolve rows");
        const data = await res.json();
        setResolvedRows(data.rows);
        toast({ title: "File parsed", description: `${data.matchedCount} matched, ${data.unmatchedCount} unmatched out of ${rows.length} rows.` });
      } catch (err: any) {
        toast({ title: "Failed to parse file", description: err?.message ?? "Unknown error", variant: "destructive" });
      } finally {
        setIsParsing(false);
        setIsResolving(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [departmentId, toast]
  );

  const handleImport = useCallback(async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/${departmentId}/training/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows }),
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      toast({ title: "Import complete", description: `${data.imported} rows saved (${data.unmatched} unmatched).` });
      setParsedRows(null);
      setResolvedRows(null);
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }, [departmentId, parsedRows, toast]);

  // Abort in-flight requests when filters change quickly, so a slow stale
  // response can never overwrite the result of a newer request.
  const registryAbortRef = useRef<AbortController | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);

  const loadRegistry = useCallback(async () => {
    registryAbortRef.current?.abort();
    const controller = new AbortController();
    registryAbortRef.current = controller;
    setIsLoadingRegistry(true);
    try {
      const params = new URLSearchParams();
      if (!allYears) {
        params.set("dateFrom", `${year}-01-01`);
        params.set("dateTo", `${year}-12-31`);
      }
      if (excludedTypesParam) params.set("excludeEmployeeTypeIds", excludedTypesParam);
      const res = await fetch(`/api/${departmentId}/training?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to load registry");
      const data = await res.json();
      setTrainings(data.trainings);
    } catch (err: any) {
      if (err?.name === "AbortError") return; // superseded by a newer request
      toast({ title: "Failed to load registry", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      if (registryAbortRef.current === controller) setIsLoadingRegistry(false);
    }
  }, [departmentId, year, allYears, excludedTypesParam, toast]);

  const loadSummary = useCallback(async () => {
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setIsLoadingSummary(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (allYears) params.set("allYears", "1");
      if (excludedTypesParam) params.set("excludeEmployeeTypeIds", excludedTypesParam);
      const res = await fetch(`/api/${departmentId}/training/summary?${params.toString()}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to load summary");
      const data: TrainingSummaryResponse = await res.json();
      setSummary(data);
      setTargetDraft(data.target);
    } catch (err: any) {
      if (err?.name === "AbortError") return; // superseded by a newer request
      toast({ title: "Failed to load dashboard", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      if (summaryAbortRef.current === controller) setIsLoadingSummary(false);
    }
  }, [departmentId, year, allYears, excludedTypesParam, toast]);

  // Load the employee-type options once for the exclude filter.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/${departmentId}/employee_type`);
        if (!res.ok) return;
        const data = (await res.json()) as Option[];
        if (!cancelled) setEmployeeTypeOptions(data);
      } catch {
        // non-fatal: the filter just stays empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  // Refetch whenever the active tab needs data or the year / exclude filter changes.
  useEffect(() => {
    if (activeTab === "registry") {
      loadRegistry();
      loadSummary();
    } else if (activeTab === "dashboard") {
      loadSummary();
    }
  }, [activeTab, loadRegistry, loadSummary]);

  const handleSaveTargets = useCallback(async () => {
    if (!targetDraft) return;
    setIsSavingTargets(true);
    try {
      const res = await fetch(`/api/${departmentId}/training/targets`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, ...targetDraft }),
      });
      if (!res.ok) throw new Error("Failed to save targets");
      toast({ title: "Targets saved" });
      await loadSummary();
    } catch (err: any) {
      toast({ title: "Failed to save targets", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setIsSavingTargets(false);
    }
  }, [departmentId, targetDraft, year, loadSummary, toast]);

  const openDrilldown = useCallback(
    (key: DrilldownKey) => {
      setDrilldown(key);
      // These breakdowns list individual training records, which live in the
      // registry dataset — fetch it lazily if the user hasn't opened that tab yet.
      const needsTrainings = key === "trainingsConducted" || key === "employeesTrained" || key === "mandatoryTrainings";
      if (needsTrainings && trainings === null && !isLoadingRegistry) {
        loadRegistry();
      }
    },
    [trainings, isLoadingRegistry, loadRegistry]
  );

  const employeesTrainedRows = useMemo(() => {
    if (!trainings) return [];
    const byEmployee = new Map<string, { name: string; office: string; count: number; hours: number }>();
    for (const t of trainings) {
      if (!t.employee) continue;
      const entry = byEmployee.get(t.employee.id) ?? {
        name: trainingEmployeeDisplayName(t),
        office: t.employee.offices?.name ?? "",
        count: 0,
        hours: 0,
      };
      entry.count += 1;
      entry.hours += t.durationHours || 0;
      byEmployee.set(t.employee.id, entry);
    }
    return Array.from(byEmployee.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trainings]);

  const mandatoryTrainingRows = useMemo(
    () => (trainings ?? []).filter((t) => t.indicator === "Mandatory Training"),
    [trainings]
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="registry">Registry (Annex 6-G)</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard (Annex 6-H)</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Exclude types
                {excludedTypeIds.length > 0 ? (
                  <Badge variant="secondary" className="ml-1">
                    {excludedTypeIds.length}
                  </Badge>
                ) : null}
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-2">
              <p className="text-xs text-muted-foreground">
                Employees with these types are excluded from the registry and all dashboard computations.
              </p>
              {employeeTypeOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employee types found.</p>
              ) : (
                <div className="max-h-56 space-y-1 overflow-auto">
                  {employeeTypeOptions.map((option) => {
                    const checked = excludedTypeIds.includes(option.id);
                    return (
                      <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-secondary/50">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setExcludedTypeIds((prev) =>
                              value === true ? [...prev, option.id] : prev.filter((id) => id !== option.id)
                            )
                          }
                        />
                        {option.name}
                      </label>
                    );
                  })}
                </div>
              )}
              {excludedTypeIds.length > 0 ? (
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setExcludedTypeIds([])}>
                  Clear
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2">
            <Label htmlFor="year" className="text-sm text-muted-foreground">
              Year
            </Label>
            <Input
              id="year"
              type="number"
              className="w-24"
              value={year}
              disabled={allYears}
              onChange={(e) => setYear(Number(e.target.value) || year)}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={allYears} onCheckedChange={(value) => setAllYears(value === true)} />
            All years
          </label>
        </div>
      </div>

      <TabsContent value="import">
        <Card>
          <CardHeader>
            <CardTitle>Upload Training Records</CardTitle>
            <CardDescription>
              Upload the SKILLPATH training export (.xlsx). Rows are matched to employees by BIO number before anything is saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isParsing || isResolving}>
                {isParsing || isResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Choose file
              </Button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
              {parsedRows ? <span className="text-sm text-muted-foreground">{parsedRows.length} rows parsed</span> : null}
            </div>

            {resolvedRows ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{matchedCount} matched</Badge>
                  {matchedByNameCount > 0 ? (
                    <Badge variant="outline" title="Matched by employee name because the Bio Number was blank or wrong">
                      {matchedByNameCount} matched by name
                    </Badge>
                  ) : null}
                  <Badge variant={unmatchedRows.length > 0 ? "destructive" : "secondary"}>{unmatchedRows.length} unmatched</Badge>
                </div>

                {unmatchedRows.length > 0 ? (
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bio Number</TableHead>
                          <TableHead>Name (from sheet)</TableHead>
                          <TableHead>Certificate Title</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatchedRows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell>{row.bioNumberRaw}</TableCell>
                            <TableCell>{row.nameRaw}</TableCell>
                            <TableCell>{row.certificateTitle}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : null}

                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save {matchedCount} matched row{matchedCount === 1 ? "" : "s"} to the registry
                </Button>
                <p className="text-xs text-muted-foreground">
                  Unmatched rows are also saved (with their raw BIO number) so they can be re-linked later once fixed.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="registry" className="space-y-6">
        {summary === null && trainings === null ? null : null}
        <div className="flex justify-end">
          <Button
            variant="outline"
            disabled={!trainings}
            onClick={() => trainings && summary && exportTrainingRegistryExcel(trainings, summary.registry, year)}
          >
            Export to Excel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Summary Monitoring</CardTitle>
            <CardDescription>
              {allYears ? "All years" : `Year ${year}`}
              {excludedTypeIds.length > 0 ? ` · Excluding ${excludedTypeIds.length} employee type${excludedTypeIds.length === 1 ? "" : "s"}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary ? (
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>Total Trainings Conducted</TableCell>
                    <TableCell className="text-right font-semibold">{numberFormatter.format(summary.registry.totalTrainingsConducted)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Employees Trained</TableCell>
                    <TableCell className="text-right font-semibold">{numberFormatter.format(summary.registry.totalEmployeesTrained)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Total Training Hours Completed</TableCell>
                    <TableCell className="text-right font-semibold">{numberFormatter.format(summary.registry.totalTrainingHoursCompleted)}</TableCell>
                  </TableRow>
                  {Object.entries(summary.registry.byIndicator).map(([indicator, count]) => (
                    <TableRow key={indicator}>
                      <TableCell>{indicator}s</TableCell>
                      <TableCell className="text-right font-semibold">{numberFormatter.format(count)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>Employees with at Least One Training</TableCell>
                    <TableCell className="text-right font-semibold">{numberFormatter.format(summary.registry.employeesWithAtLeastOneTraining)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Employees with No Training Intervention</TableCell>
                    <TableCell className="text-right font-semibold">{numberFormatter.format(summary.registry.employeesWithNoTrainingIntervention)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                {isLoadingSummary ? <Loader2 className="h-5 w-5 animate-spin" /> : "Open this tab to load the summary."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training Monitoring Registry</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRegistry ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : trainings && trainings.length > 0 ? (
              <div className="overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead>Training Title</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Date Conducted</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Competency Addressed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainings.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{trainingEmployeeDisplayName(t)}</TableCell>
                        <TableCell>{t.employee?.position || t.positionRaw}</TableCell>
                        <TableCell>{t.employee?.offices?.name || t.officeNameRaw}</TableCell>
                        <TableCell className="max-w-xs truncate" title={t.certificateTitle}>
                          {t.certificateTitle}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={t.provider}>
                          {t.provider}
                        </TableCell>
                        <TableCell>{formatDate(t.dateStart)}</TableCell>
                        <TableCell className="text-right">{t.durationHours}</TableCell>
                        <TableCell>{t.trainingType}</TableCell>
                        <TableCell className="max-w-xs truncate" title={t.competencyAddressed}>
                          {t.competencyAddressed}
                        </TableCell>
                        <TableCell>{t.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No training records {allYears ? "yet" : `for ${year} yet`}.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="dashboard" className="space-y-6">
        <div className="flex justify-end">
          <Button variant="outline" disabled={!summary} onClick={() => summary && exportLearningDashboardExcel(summary, year)}>
            Export to Excel
          </Button>
        </div>

        {isLoadingSummary || !summary || !targetDraft ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>I. Learning and Development Performance Summary</CardTitle>
                <CardDescription>
                  Targets are editable; actuals are computed from imported training records.
                  {excludedTypeIds.length > 0 ? ` Excluding ${excludedTypeIds.length} employee type${excludedTypeIds.length === 1 ? "" : "s"}.` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicator</TableHead>
                      <TableHead className="w-28 text-center">Target</TableHead>
                      <TableHead className="w-28 text-center">Actual</TableHead>
                      <TableHead className="w-32 text-center">% Accomplishment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {([
                      { label: "Employees Covered by Training Needs Assessment (TNA)", targetKey: "targetEmployeesCoveredByTNA", actual: summary.sectionI[0].actual, editableActual: "actualEmployeesCoveredByTNA" },
                      { label: "Approved Training Programs", targetKey: "targetApprovedTrainingPrograms", actual: summary.sectionI[1].actual, drilldown: "approvedPrograms" },
                      { label: "Trainings Conducted", targetKey: "targetTrainingsConducted", actual: summary.sectionI[2].actual, drilldown: "trainingsConducted" },
                      { label: "Employees Trained", targetKey: "targetEmployeesTrained", actual: summary.sectionI[3].actual, drilldown: "employeesTrained" },
                      { label: "Mandatory Trainings Completed", targetKey: "targetMandatoryTrainingsCompleted", actual: summary.sectionI[4].actual, drilldown: "mandatoryTrainings" },
                      { label: "Competency Gaps Addressed", targetKey: "targetCompetencyGapsAddressed", actual: summary.sectionI[5].actual, drilldown: "competencyGaps" },
                      { label: "Employees Completing Post-Training Reports", targetKey: "targetPostTrainingReports", actual: summary.sectionI[6].actual, editableActual: "actualPostTrainingReports" },
                      { label: "Training Budget Utilized", targetKey: "targetTrainingBudget", actual: summary.sectionI[7].actual, editableActual: "actualTrainingBudgetUtilized" },
                    ] as Array<{ label: string; targetKey: string; actual: number; editableActual?: string; drilldown?: DrilldownKey }>).map((row) => (
                      <TableRow key={row.label}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            className="mx-auto w-24 text-center"
                            value={targetDraft[row.targetKey] ?? 0}
                            onChange={(e) => setTargetDraft({ ...targetDraft, [row.targetKey]: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {row.editableActual ? (
                            <Input
                              type="number"
                              className="mx-auto w-24 text-center"
                              value={targetDraft[row.editableActual] ?? 0}
                              onChange={(e) => setTargetDraft({ ...targetDraft, [row.editableActual!]: Number(e.target.value) || 0 })}
                            />
                          ) : row.drilldown ? (
                            <button
                              type="button"
                              onClick={() => openDrilldown(row.drilldown!)}
                              className="rounded px-2 py-1 font-semibold text-indigo-600 underline-offset-4 transition-colors hover:bg-indigo-50 hover:underline"
                              title={`View the records behind this number`}
                            >
                              {numberFormatter.format(row.actual)}
                            </button>
                          ) : (
                            numberFormatter.format(row.actual)
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {targetDraft[row.targetKey] > 0
                            ? `${Math.round(((row.editableActual ? targetDraft[row.editableActual] : row.actual) / targetDraft[row.targetKey]) * 1000) / 10}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 flex justify-end">
                  <Button onClick={handleSaveTargets} disabled={isSavingTargets}>
                    {isSavingTargets ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Targets
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>II. Training Implementation Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Training Program</TableHead>
                        <TableHead>Type of Training</TableHead>
                        <TableHead>Actual Participants</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.implementationStatus.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="max-w-sm truncate" title={row.certificateTitle}>
                            {row.certificateTitle}
                          </TableCell>
                          <TableCell>{row.trainingType}</TableCell>
                          <TableCell>{row.actualParticipants}</TableCell>
                          <TableCell>
                            {formatDate(row.scheduleStart)} – {formatDate(row.scheduleEnd)}
                          </TableCell>
                          <TableCell>{row.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>III. Training Coverage by Office</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Office/Department</TableHead>
                      <TableHead className="text-right">Total Personnel</TableHead>
                      <TableHead className="text-right">Personnel Trained</TableHead>
                      <TableHead className="text-right">Coverage Rate (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.officeCoverage.map((row) => (
                      <TableRow key={row.officeId}>
                        <TableCell>{row.officeName}</TableCell>
                        <TableCell className="text-right">{row.totalPersonnel}</TableCell>
                        <TableCell className="text-right">{row.personnelTrained}</TableCell>
                        <TableCell className="text-right">{row.coverageRate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>IV. Priority Competency Gaps</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competency Area</TableHead>
                      <TableHead className="text-right">Employees Affected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.competencyGaps.map((row) => (
                      <TableRow key={row.competencyArea}>
                        <TableCell>{row.competencyArea}</TableCell>
                        <TableCell className="text-right">{row.employeesAffected}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>V. Year-End Learning and Development Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment Area</TableHead>
                      <TableHead className="text-right">Target</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.sectionV.map((row) => (
                      <TableRow key={row.indicator}>
                        <TableCell>{row.indicator}</TableCell>
                        <TableCell className="text-right">{row.target}</TableCell>
                        <TableCell className="text-right">{row.actual}</TableCell>
                        <TableCell className="text-right">{row.actual >= row.target && row.target > 0 ? "Met" : "In Progress"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </TabsContent>

      <Dialog open={drilldown !== null} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{drilldown ? DRILLDOWN_TITLES[drilldown] : ""}</DialogTitle>
            <DialogDescription>Records behind this number for {year}.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto">
            {drilldown === "approvedPrograms" && summary ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Training Program</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Participants</TableHead>
                    <TableHead>Schedule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.implementationStatus.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-sm">{row.certificateTitle}</TableCell>
                      <TableCell>{row.trainingType}</TableCell>
                      <TableCell className="text-center">{row.actualParticipants}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.scheduleStart)} – {formatDate(row.scheduleEnd)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}

            {(drilldown === "trainingsConducted" || drilldown === "mandatoryTrainings") &&
              (isLoadingRegistry || trainings === null ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Training Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Hours</TableHead>
                      <TableHead>Indicator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(drilldown === "mandatoryTrainings" ? mandatoryTrainingRows : trainings).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap">{trainingEmployeeDisplayName(t)}</TableCell>
                        <TableCell className="max-w-sm">{t.certificateTitle}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(t.dateStart)}</TableCell>
                        <TableCell className="text-center">{t.durationHours}</TableCell>
                        <TableCell className="whitespace-nowrap">{t.indicator}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ))}

            {drilldown === "employeesTrained" &&
              (isLoadingRegistry || trainings === null ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Office</TableHead>
                      <TableHead className="text-center">Trainings</TableHead>
                      <TableHead className="text-center">Total Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeesTrainedRows.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                        <TableCell>{row.office}</TableCell>
                        <TableCell className="text-center">{row.count}</TableCell>
                        <TableCell className="text-center">{row.hours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ))}

            {drilldown === "competencyGaps" && summary ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competency Area</TableHead>
                    <TableHead className="text-center">Employees Affected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.competencyGaps.map((row) => (
                    <TableRow key={row.competencyArea}>
                      <TableCell>{row.competencyArea}</TableCell>
                      <TableCell className="text-center">{row.employeesAffected}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
