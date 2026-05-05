"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Option = { id: string; name: string };
type EmployeeOption = {
  id: string;
  name: string;
  position: string;
  isArchived: boolean;
  officeId: string;
  officeName: string;
  employeeTypeId: string;
  employeeTypeName: string;
  suggestedIndicatorName: string;
  suggestionConfidence: "high" | "medium" | "low";
  suggestionReason: string;
};
type Group = { id: string; name: string; sortOrder: number; offices: Option[] };
type Dimension =
  | "employeeType"
  | "gender"
  | "maritalStatus"
  | "eligibility"
  | "office"
  | "position"
  | "status"
  | "headStatus";

type ReportResult = {
  year: number;
  cutoff: string;
  populationMode: "active" | "all";
  dimension: Dimension;
  columns: string[];
  rows: Array<{ id: string; label: string; counts: Record<string, number>; total: number }>;
  totals: Record<string, number>;
  grandTotal: number;
  meta: Record<string, unknown> & {
    cacheStatus?: "hit" | "miss" | "recomputed";
    cacheGeneratedAt?: string | null;
  };
};

type Snapshot = {
  id: string;
  effectiveAt: string;
  officeName: string;
  employeeTypeName: string;
  eligibilityName: string;
  indicatorId: string | null;
  indicatorName: string;
  position: string;
  gender: string | null;
  maritalStatus: string | null;
  isHead: boolean;
  status: string;
  source: string;
  note: string | null;
};

const DIMENSION_LABELS: Record<Dimension, string> = {
  employeeType: "Employee type",
  gender: "Gender",
  maritalStatus: "Marital status",
  eligibility: "Eligibility",
  office: "Office",
  position: "Position",
  status: "Status",
  headStatus: "Head / non-head",
};

const numberFormatter = new Intl.NumberFormat("en-US");
const INDICATOR_ALIASES: Record<string, string[]> = {
  clerical: ["clerical", "clerical services"],
  health: ["health", "health nutrition and population control"],
  "it service": ["it service", "it services"],
  janitor: ["janitor", "janitorial services"],
  security: ["security", "security services"],
  teacher: ["teacher", "education"],
  technical: ["technical"],
  trade: ["trade"],
  others: ["others", "other"],
};

function normalizeIndicatorText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function getCanonicalIndicatorName(value: string) {
  const normalized = normalizeIndicatorText(value);
  return (
    Object.entries(INDICATOR_ALIASES).find(([, aliases]) =>
      aliases.some((alias) => normalizeIndicatorText(alias) === normalized)
    )?.[0] ?? normalized
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toYearEndInputValue(year: number) {
  return `${year}-12-31`;
}

export default function WorkforceHistoryTool({ departmentId }: { departmentId: string }) {
  const currentYear = new Date().getFullYear();
  const latestCompletedReportYear = Math.max(1900, currentYear - 1);
  const [year, setYear] = useState(latestCompletedReportYear);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [populationMode, setPopulationMode] = useState<"active" | "all">("active");
  const [dimension, setDimension] = useState<Dimension>("employeeType");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [offices, setOffices] = useState<Option[]>([]);
  const [employeeTypes, setEmployeeTypes] = useState<Option[]>([]);
  const [eligibilities, setEligibilities] = useState<Option[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [suggestionEmployees, setSuggestionEmployees] = useState<EmployeeOption[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(true);

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupSortOrder, setGroupSortOrder] = useState(0);
  const [groupOfficeIds, setGroupOfficeIds] = useState<string[]>([]);
  const [savingGroup, setSavingGroup] = useState(false);
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [suggestionEffectiveAt, setSuggestionEffectiveAt] = useState(toYearEndInputValue(currentYear));
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  const [cleaningSuggestions, setCleaningSuggestions] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({
    effectiveAt: "",
    officeId: "",
    employeeTypeId: "",
    eligibilityId: "",
    indicatorId: "",
    position: "",
    gender: "",
    maritalStatus: "",
    isHead: false,
    status: "ACTIVE",
    note: "",
  });

  const selectedOfficeSet = useMemo(() => new Set(groupOfficeIds), [groupOfficeIds]);
  const selectedGroupSet = useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedSuggestionSet = useMemo(() => new Set(selectedSuggestionIds), [selectedSuggestionIds]);
  const indicatorIdByName = useMemo(
    () => new Map(groups.map((group) => [group.name.trim().toLowerCase(), group.id])),
    [groups]
  );
  const indicatorByCanonicalName = useMemo(() => {
    const map = new Map<string, Group>();
    for (const group of groups) {
      map.set(getCanonicalIndicatorName(group.name), group);
    }
    return map;
  }, [groups]);
  const suggestedEmployees = useMemo(() => {
    const query = suggestionSearch.trim().toLowerCase();
    const rows = suggestionEmployees
      .map((employee) => {
        const resolvedIndicator =
          indicatorByCanonicalName.get(getCanonicalIndicatorName(employee.suggestedIndicatorName)) ??
          indicatorByCanonicalName.get("others");

        return {
          ...employee,
          suggestedIndicatorId:
            resolvedIndicator?.id ??
            indicatorIdByName.get(employee.suggestedIndicatorName.trim().toLowerCase()) ??
            indicatorIdByName.get("others") ??
            "",
          suggestedIndicatorDisplayName: resolvedIndicator?.name ?? employee.suggestedIndicatorName,
        };
      })
      .filter((employee) => employee.suggestedIndicatorId);

    if (!query) return rows;
    return rows.filter((employee) =>
      [employee.name, employee.position, employee.officeName, employee.suggestedIndicatorName, employee.suggestedIndicatorDisplayName]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [indicatorByCanonicalName, indicatorIdByName, suggestionEmployees, suggestionSearch]);

  const loadSetup = useCallback(async () => {
    setLoadingSetup(true);
    try {
      const [optionsResponse, groupsResponse] = await Promise.all([
        fetch(
          `/api/${departmentId}/analytics/workforce-history/options?includeSuggestions=false`
        ),
        fetch(`/api/${departmentId}/analytics/workforce-history/groups`),
      ]);
      if (!optionsResponse.ok) throw new Error(await optionsResponse.text());
      if (!groupsResponse.ok) throw new Error(await groupsResponse.text());

      const options = await optionsResponse.json();
      const nextGroups = (await groupsResponse.json()) as Group[];
      const nextAvailableYears = Array.isArray(options.availableYears)
        ? options.availableYears.filter(
            (value: unknown): value is number =>
              typeof value === "number" && Number.isInteger(value) && value <= latestCompletedReportYear
          )
        : [];

      setAvailableYears(nextAvailableYears);
      setYear((current) => (nextAvailableYears.length && !nextAvailableYears.includes(current) ? nextAvailableYears[0] : current));
      if (!nextAvailableYears.length) {
        setReport(null);
      }
      setOffices(options.offices ?? []);
      setEmployeeTypes(options.employeeTypes ?? []);
      setEligibilities(options.eligibilities ?? []);
      setEmployees(options.employees ?? []);
      setGroups(nextGroups);
      setSelectedGroupIds((prev) => prev.filter((id) => nextGroups.some((group) => group.id === id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load workforce history setup.");
    } finally {
      setLoadingSetup(false);
    }
  }, [departmentId, latestCompletedReportYear]);

  const runReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          populationMode,
          dimension,
          groupIds: selectedGroupIds,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setReport((await response.json()) as ReportResult);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate report.");
    } finally {
      setLoadingReport(false);
    }
  }, [departmentId, dimension, populationMode, selectedGroupIds, year]);

  const loadSuggestions = useCallback(
    async (targetYear: number, targetPopulationMode: "active" | "all", signal?: AbortSignal) => {
      setLoadingSuggestions(true);
      try {
        const response = await fetch(
          `/api/${departmentId}/analytics/workforce-history/options?year=${encodeURIComponent(
            String(targetYear)
          )}&populationMode=${encodeURIComponent(targetPopulationMode)}`,
          { signal }
        );
        if (!response.ok) throw new Error(await response.text());
        const options = await response.json();
        if (signal?.aborted) return;

        const nextSuggestionEmployees = (options.suggestionEmployees ?? []) as EmployeeOption[];
        setSuggestionEmployees(nextSuggestionEmployees);
        setSelectedSuggestionIds((prev) =>
          prev.filter((id) => nextSuggestionEmployees.some((employee) => employee.id === id))
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error(error instanceof Error ? error.message : "Failed to load workforce history suggestions.");
      } finally {
        if (!signal?.aborted) {
          setLoadingSuggestions(false);
        }
      }
    },
    [departmentId]
  );

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  useEffect(() => {
    setSuggestionEffectiveAt(toYearEndInputValue(year));
  }, [year]);

  useEffect(() => {
    if (availableYears.includes(year)) void runReport();
  }, [availableYears, dimension, populationMode, runReport, selectedGroupIds, year]);

  useEffect(() => {
    if (!availableYears.includes(year)) return;
    const controller = new AbortController();
    void loadSuggestions(year, populationMode, controller.signal);
    return () => controller.abort();
  }, [availableYears, loadSuggestions, populationMode, year]);

  const clearGroupForm = () => {
    setEditingGroupId(null);
    setGroupName("");
    setGroupSortOrder(0);
    setGroupOfficeIds([]);
  };

  const saveGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Group name is required.");
      return;
    }

    setSavingGroup(true);
    try {
      const response = await fetch(
        editingGroupId
          ? `/api/${departmentId}/analytics/workforce-history/groups/${editingGroupId}`
          : `/api/${departmentId}/analytics/workforce-history/groups`,
        {
          method: editingGroupId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: groupName,
            sortOrder: groupSortOrder,
            officeIds: groupOfficeIds,
          }),
        }
      );
      if (!response.ok) throw new Error(await response.text());
      clearGroupForm();
      await loadSetup();
      toast.success("Indicator saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save group.");
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    setSavingGroup(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/groups/${groupId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      await loadSetup();
      clearGroupForm();
      toast.success("Indicator deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete group.");
    } finally {
      setSavingGroup(false);
    }
  };

  const editGroup = (group: Group) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupSortOrder(group.sortOrder);
    setGroupOfficeIds(group.offices.map((office) => office.id));
  };

  const backfillSnapshots = async () => {
    setLoadingSetup(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/backfill`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      toast.success(
        `Backfill complete: ${result.snapshotsCreated ?? 0} snapshots created, ${result.snapshotsUpdated ?? 0} indicators repaired.`
      );
      await runReport();
      if (selectedEmployeeId) await loadSnapshots(selectedEmployeeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backfill failed.");
    } finally {
      setLoadingSetup(false);
    }
  };

  const applyIndicatorSuggestions = async () => {
    const assignments = suggestedEmployees
      .filter((employee) => selectedSuggestionSet.has(employee.id))
      .map((employee) => ({
        employeeId: employee.id,
        indicatorId: employee.suggestedIndicatorId,
      }));

    if (assignments.length === 0) {
      toast.error("Select at least one suggested employee.");
      return;
    }

    setApplyingSuggestions(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/indicator-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveAt: suggestionEffectiveAt,
          assignments,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      setSelectedSuggestionIds([]);
      await runReport();
      if (selectedEmployeeId) await loadSnapshots(selectedEmployeeId);
      const skipDetails = [
        result.skippedBeforeHire ? `${result.skippedBeforeHire} before hire` : "",
        result.skippedNoSnapshot ? `${result.skippedNoSnapshot} no snapshot` : "",
        result.skippedAlreadyCurrent ? `${result.skippedAlreadyCurrent} already current` : "",
      ].filter(Boolean);
      toast.success(
        `Applied suggestions: ${result.updated ?? 0} updated, ${result.created ?? 0} created, ${result.skipped ?? 0} skipped${
          skipDetails.length ? ` (${skipDetails.join(", ")})` : ""
        }.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply suggestions.");
    } finally {
      setApplyingSuggestions(false);
    }
  };

  const cleanupSuggestionSnapshots = async () => {
    if (!suggestionEffectiveAt) {
      toast.error("Set an effective date first.");
      return;
    }

    setCleaningSuggestions(true);
    try {
      const previewResponse = await fetch(
        `/api/${departmentId}/analytics/workforce-history/cleanup-suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            effectiveDate: suggestionEffectiveAt,
            dryRun: true,
          }),
        }
      );
      if (!previewResponse.ok) throw new Error(await previewResponse.text());
      const preview = await previewResponse.json();
      const matched = Number(preview?.matched ?? 0);

      if (matched <= 0) {
        toast.message("No matching suggestion snapshots found for that date.");
        return;
      }

      const confirmed = window.confirm(
        `Delete ${matched} indicator suggestion snapshots dated ${suggestionEffectiveAt}? This will refresh yearly counts.`
      );
      if (!confirmed) return;

      const response = await fetch(
        `/api/${departmentId}/analytics/workforce-history/cleanup-suggestions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            effectiveDate: suggestionEffectiveAt,
          }),
        }
      );
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();
      toast.success(`Deleted ${result.deleted ?? 0} suggestion snapshots for ${suggestionEffectiveAt}.`);
      await loadSetup();
      await runReport();
      if (selectedEmployeeId) await loadSnapshots(selectedEmployeeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clean suggestion snapshots.");
    } finally {
      setCleaningSuggestions(false);
    }
  };

  const cleanupPreHireSuggestionSnapshots = async () => {
    setCleaningSuggestions(true);
    try {
      const previewResponse = await fetch(`/api/${departmentId}/analytics/workforce-history/cleanup-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "pre_hire",
          dryRun: true,
        }),
      });
      if (!previewResponse.ok) throw new Error(await previewResponse.text());
      const preview = await previewResponse.json();
      const matched = Number(preview?.matched ?? 0);

      if (matched <= 0) {
        toast.message("No pre-hire suggestion snapshots found.");
        return;
      }

      const confirmed = window.confirm(
        `Delete ${matched} pre-hire indicator suggestion snapshots? This will refresh yearly counts.`
      );
      if (!confirmed) return;

      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/cleanup-suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "pre_hire" }),
      });
      if (!response.ok) throw new Error(await response.text());
      const result = await response.json();

      toast.success(`Deleted ${result.deleted ?? 0} pre-hire suggestion snapshots.`);
      await loadSetup();
      await runReport();
      if (selectedEmployeeId) await loadSnapshots(selectedEmployeeId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clean pre-hire suggestion snapshots.");
    } finally {
      setCleaningSuggestions(false);
    }
  };

  const loadSnapshots = useCallback(
    async (employeeId: string) => {
      if (!employeeId) {
        setSnapshots([]);
        return;
      }

      setLoadingSnapshots(true);
      try {
        const response = await fetch(
          `/api/${departmentId}/analytics/workforce-history/snapshots?employeeId=${encodeURIComponent(employeeId)}`
        );
        if (!response.ok) throw new Error(await response.text());
        setSnapshots((await response.json()) as Snapshot[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load snapshots.");
      } finally {
        setLoadingSnapshots(false);
      }
    },
    [departmentId]
  );

  const saveSnapshot = async () => {
    if (!selectedEmployeeId || !snapshotForm.effectiveAt) {
      toast.error("Select an employee and effective date.");
      return;
    }

    setSavingSnapshot(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          ...snapshotForm,
          gender: snapshotForm.gender || null,
          maritalStatus: snapshotForm.maritalStatus || null,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSnapshotForm((prev) => ({ ...prev, note: "" }));
      await loadSnapshots(selectedEmployeeId);
      await runReport();
      toast.success("Snapshot added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save snapshot.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const deleteSnapshot = async (snapshotId: string) => {
    setSavingSnapshot(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-history/snapshots/${snapshotId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      await loadSnapshots(selectedEmployeeId);
      await runReport();
      toast.success("Snapshot deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete snapshot.");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const exportXlsx = () => {
    if (!report) return;

    const header = ["Indicator", ...report.columns, "Total"];
    const rows = report.rows.map((row) => [
      row.label,
      ...report.columns.map((column) => row.counts[column] ?? 0),
      row.total,
    ]);
    const totals = ["Total", ...report.columns.map((column) => report.totals[column] ?? 0), report.grandTotal];
    const data = [
      [`Year: ${report.year}`],
      [`Population: ${report.populationMode === "active" ? "Active as of Dec 31" : "All employees with status as of Dec 31"}`],
      [`Breakdown: ${DIMENSION_LABELS[report.dimension]}`],
      [],
      header,
      ...rows,
      totals,
    ];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!cols"] = header.map((label) => ({ wch: Math.max(14, String(label).length + 2) }));
    XLSX.utils.book_append_sheet(workbook, sheet, "Workforce History");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    downloadBlob(
      new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `workforce-history-${report.year}-${report.dimension}.xlsx`
    );
  };

  const isFetchingReportData = loadingSetup || loadingReport;

  return (
    <div className="relative grid gap-6 xl:grid-cols-[360px,1fr]" aria-busy={isFetchingReportData}>
      {isFetchingReportData ? (
        <div className="absolute inset-0 z-50 flex cursor-wait items-start justify-center bg-background/50 pt-24 backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading workforce history data</span>
          </div>
        </div>
      ) : null}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Controls</CardTitle>
            <CardDescription>Counts are based on the latest snapshot on or before Dec 31.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="history-year">Year</Label>
              <Select
                value={availableYears.includes(year) ? String(year) : ""}
                onValueChange={(value) => setYear(Number(value))}
                disabled={availableYears.length === 0}
              >
                <SelectTrigger id="history-year">
                  <SelectValue placeholder={loadingSetup ? "Loading years" : "No years available"} />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((availableYear) => (
                    <SelectItem key={availableYear} value={String(availableYear)}>
                      {availableYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Population</Label>
              <Select value={populationMode} onValueChange={(value) => setPopulationMode(value as "active" | "all")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active as of Dec 31</SelectItem>
                  <SelectItem value="all">All employees with status as of Dec 31</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Breakdown</Label>
              <Select value={dimension} onValueChange={(value) => setDimension(value as Dimension)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIMENSION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Indicators shown</Label>
              <div className="rounded-md border p-2">
                {groups.length ? (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <label key={group.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedGroupSet.has(group.id)}
                          onCheckedChange={(checked) => {
                            setSelectedGroupIds((prev) =>
                              checked ? [...prev, group.id] : prev.filter((id) => id !== group.id)
                            );
                          }}
                        />
                        <span>{group.name}</span>
                      </label>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedGroupIds([])}>
                      Show all groups
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No indicators configured yet.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={runReport} disabled={loadingReport || loadingSetup}>
                {loadingReport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
              <Button type="button" variant="outline" onClick={exportXlsx} disabled={!report}>
                <Download className="mr-2 h-4 w-4" />
                XLSX
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicators</CardTitle>

          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr,96px] gap-2">
              <div className="space-y-2">
                <Label htmlFor="group-name">Indicator name</Label>
                <Input id="group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-order">Order</Label>
                <Input
                  id="group-order"
                  type="number"
                  value={groupSortOrder}
                  onChange={(event) => setGroupSortOrder(Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Office fallback mapping</Label>
              <ScrollArea className="h-52 rounded-md border p-3">
                <div className="space-y-2">
                  {offices.map((office) => (
                    <label key={office.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedOfficeSet.has(office.id)}
                        onCheckedChange={(checked) => {
                          setGroupOfficeIds((prev) =>
                            checked ? [...prev, office.id] : prev.filter((id) => id !== office.id)
                          );
                        }}
                      />
                      <span>{office.name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveGroup} disabled={savingGroup}>
                {savingGroup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {editingGroupId ? "Update indicator" : "Add indicator"}
              </Button>
              <Button type="button" variant="ghost" onClick={clearGroupForm}>
                Clear
              </Button>
            </div>

            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <button type="button" className="text-left" onClick={() => editGroup(group)}>
                    <p className="text-sm font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{group.offices.length} offices</p>
                  </button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => deleteGroup(group.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{report ? `Year: ${report.year}` : "Yearly Report"}</CardTitle>
            <CardDescription>
              {report
                ? `${DIMENSION_LABELS[report.dimension]} breakdown, ${numberFormatter.format(report.grandTotal)} total records.`
                : "Run a report to populate results. Baseline backfill is under Advanced Tools."}
            </CardDescription>
            {report?.meta?.cacheStatus ? (
              <p className="text-xs text-muted-foreground">
                Cache: {report.meta.cacheStatus}
                {report.meta.cacheGeneratedAt ? ` (${new Date(report.meta.cacheGeneratedAt).toLocaleString()})` : ""}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            {report && report.columns.length ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-64">Indicator</TableHead>
                      {report.columns.map((column) => (
                        <TableHead key={column} className="text-right">
                          {column}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        {report.columns.map((column) => (
                          <TableCell key={column} className="text-right">
                            {numberFormatter.format(row.counts[column] ?? 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold">{numberFormatter.format(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      {report.columns.map((column) => (
                        <TableCell key={column} className="text-right">
                          {numberFormatter.format(report.totals[column] ?? 0)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">{numberFormatter.format(report.grandTotal)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No report rows yet. Use baseline backfill if this is the first time running workforce history.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicator Suggestions</CardTitle>
            <CardDescription>
              Uses local keyword rules from position and office text. Review before applying; no paid AI call is used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr,180px]">
              <div className="space-y-2">
                <Label>Search suggestions</Label>
                <Input
                  value={suggestionSearch}
                  onChange={(event) => setSuggestionSearch(event.target.value)}
                  placeholder="Search name, position, office, indicator"
                />
              </div>
              <div className="space-y-2">
                <Label>Effective date</Label>
                <Input
                  type="date"
                  value={suggestionEffectiveAt}
                  onChange={(event) => setSuggestionEffectiveAt(event.target.value)}
                />
               
              </div>
            </div>

            <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              Use this section for the normal workflow: review the suggested indicator, select rows, then apply them to the selected year.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedSuggestionIds(suggestedEmployees.map((employee) => employee.id))}
                disabled={loadingSuggestions || suggestedEmployees.length === 0}
              >
                Select shown
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelectedSuggestionIds([])}>
                Clear selected
              </Button>
              <Button
                type="button"
                onClick={applyIndicatorSuggestions}
                disabled={loadingSuggestions || applyingSuggestions || selectedSuggestionIds.length === 0}
              >
                {applyingSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Apply {selectedSuggestionIds.length} suggestions
              </Button>
            </div>

            <div className="rounded-md border">
              <ScrollArea className="h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Employee</TableHead>
                      <TableHead>Position / Office</TableHead>
                      <TableHead>Suggested indicator</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingSuggestions ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          Loading suggestions...
                        </TableCell>
                      </TableRow>
                    ) : suggestedEmployees.length ? (
                      suggestedEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedSuggestionSet.has(employee.id)}
                              onCheckedChange={(checked) => {
                                setSelectedSuggestionIds((prev) =>
                                  checked ? [...prev, employee.id] : prev.filter((id) => id !== employee.id)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{employee.name}</div>
                            <div className="text-xs text-muted-foreground">{employee.employeeTypeName || "No type"}</div>
                          </TableCell>
                          <TableCell>
                            <div>{employee.position || "No position"}</div>
                            <div className="text-xs text-muted-foreground">{employee.officeName || "No office"}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{employee.suggestedIndicatorDisplayName}</div>
                            {employee.suggestedIndicatorDisplayName !== employee.suggestedIndicatorName ? (
                              <div className="text-xs text-muted-foreground">
                                Rule: {employee.suggestedIndicatorName}
                              </div>
                            ) : null}
                            <div className="text-xs capitalize text-muted-foreground">{employee.suggestionConfidence} confidence</div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{employee.suggestionReason}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                          No suggestions available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advanced Tools</CardTitle>
            <CardDescription>
              Keep this collapsed unless you are preparing baseline history, fixing historical data, or cleaning bad suggestion snapshots.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <details className="rounded-md border p-4">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Maintenance
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Use these only when setting up or repairing historical counts. Baseline backfill creates initial workforce snapshots from employee records. Cleanup tools remove bad suggestion snapshots.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={backfillSnapshots} disabled={loadingSetup}>
                    {loadingSetup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Baseline backfill
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={cleanupSuggestionSnapshots}
                    disabled={cleaningSuggestions || applyingSuggestions}
                  >
                    {cleaningSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Cleanup Applied (date)
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={cleanupPreHireSuggestionSnapshots}
                    disabled={cleaningSuggestions || applyingSuggestions}
                  >
                    {cleaningSuggestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                    Cleanup Pre-hire
                  </Button>
                </div>
              </div>
            </details>

            <details className="rounded-md border p-4">
              <summary className="cursor-pointer list-none text-sm font-medium">
                Manual Snapshot Editor
              </summary>
              <div className="mt-3 space-y-5">
                <p className="text-xs text-muted-foreground">
                  Use this only for historical corrections that cannot be recovered from current employee records or backfill. This writes a manual timeline snapshot for one employee.
                </p>
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={selectedEmployeeId}
                    onValueChange={(value) => {
                      setSelectedEmployeeId(value);
                      void loadSnapshots(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}{employee.isArchived ? " (archived)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Effective date</Label>
                    <Input
                      type="date"
                      value={snapshotForm.effectiveAt}
                      onChange={(event) => setSnapshotForm((prev) => ({ ...prev, effectiveAt: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={snapshotForm.status} onValueChange={(value) => setSnapshotForm((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-8">
                    <Checkbox
                      checked={snapshotForm.isHead}
                      onCheckedChange={(checked) => setSnapshotForm((prev) => ({ ...prev, isHead: Boolean(checked) }))}
                    />
                    <Label>Office head</Label>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <SelectField
                    label="Indicator"
                    value={snapshotForm.indicatorId}
                    options={groups}
                    onChange={(value) => setSnapshotForm((prev) => ({ ...prev, indicatorId: value }))}
                  />
                  <SelectField
                    label="Office"
                    value={snapshotForm.officeId}
                    options={offices}
                    onChange={(value) => setSnapshotForm((prev) => ({ ...prev, officeId: value }))}
                  />
                  <SelectField
                    label="Employee type"
                    value={snapshotForm.employeeTypeId}
                    options={employeeTypes}
                    onChange={(value) => setSnapshotForm((prev) => ({ ...prev, employeeTypeId: value }))}
                  />
                  <SelectField
                    label="Eligibility"
                    value={snapshotForm.eligibilityId}
                    options={eligibilities}
                    onChange={(value) => setSnapshotForm((prev) => ({ ...prev, eligibilityId: value }))}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input
                      value={snapshotForm.position}
                      onChange={(event) => setSnapshotForm((prev) => ({ ...prev, position: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={snapshotForm.gender || "none"} onValueChange={(value) => setSnapshotForm((prev) => ({ ...prev, gender: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unknown</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Marital status</Label>
                    <Select
                      value={snapshotForm.maritalStatus || "none"}
                      onValueChange={(value) => setSnapshotForm((prev) => ({ ...prev, maritalStatus: value === "none" ? "" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unknown</SelectItem>
                        <SelectItem value="SINGLE">Single</SelectItem>
                        <SelectItem value="MARRIED">Married</SelectItem>
                        <SelectItem value="SEPARATED">Separated</SelectItem>
                        <SelectItem value="WIDOWED">Widowed</SelectItem>
                        <SelectItem value="DIVORCED">Divorced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    value={snapshotForm.note}
                    onChange={(event) => setSnapshotForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Reason or source of this correction"
                  />
                </div>

                <Button type="button" onClick={saveSnapshot} disabled={savingSnapshot || !selectedEmployeeId}>
                  {savingSnapshot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add manual snapshot
                </Button>

                <div className="rounded-md border">
                  {loadingSnapshots ? (
                    <div className="p-6 text-sm text-muted-foreground">Loading snapshots...</div>
                  ) : snapshots.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Effective</TableHead>
                          <TableHead>Indicator</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Assignment</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {snapshots.map((snapshot) => (
                          <TableRow key={snapshot.id}>
                            <TableCell>{toDateInputValue(snapshot.effectiveAt)}</TableCell>
                            <TableCell>{snapshot.indicatorName || "Fallback"}</TableCell>
                            <TableCell>{snapshot.status}</TableCell>
                            <TableCell>
                              <div className="text-sm">{snapshot.officeName || "Unknown office"}</div>
                              <div className="text-xs text-muted-foreground">
                                {[snapshot.employeeTypeName, snapshot.position].filter(Boolean).join(" / ") || "No assignment details"}
                              </div>
                            </TableCell>
                            <TableCell>{snapshot.source}</TableCell>
                            <TableCell>
                              <Button type="button" size="icon" variant="ghost" onClick={() => deleteSnapshot(snapshot.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-6 text-sm text-muted-foreground">No snapshots loaded.</div>
                  )}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || "none"} onValueChange={(next) => onChange(next === "none" ? "" : next)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Unknown</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
