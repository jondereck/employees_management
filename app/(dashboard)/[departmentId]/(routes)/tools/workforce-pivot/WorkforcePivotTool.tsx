"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

const AUTORUN_DEBOUNCE_MS = 350;
const DRILLDOWN_DEBOUNCE_MS = 250;

type Option = { id: string; name: string };
type PivotField = "employeeType" | "eligibility" | "supervisory" | "gender";
type PivotMode = "matrix" | "csc";
type Tag = { key: string; name: string };

type PivotResult = {
  rowField: PivotField;
  colField: PivotField;
  rows: Tag[];
  cols: Tag[];
  matrix: number[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
};

type CscCountRow = {
  rowKey: string;
  label: string;
  male: number;
  female: number;
  total: number;
};

type CscAverageRow = {
  rowKey: string;
  label: string;
  male: number;
  female: number;
  total: number;
};

type CscSummaryResult = {
  q39: { rows: CscCountRow[] };
  q38: { rows: CscAverageRow[] };
  meta: {
    generatedAt: string;
    matchedEmployeeCount: number;
  };
};

type DrilldownEmployee = {
  id: string;
  name: string;
  position: string;
  officeName: string;
  employeeTypeName: string;
  eligibilityName: string;
  sex: "male" | "female";
  serviceMonths: number;
};

type DrilldownResult = {
  section: "q39" | "q38";
  rowKey: string;
  rowLabel: string;
  sex: "male" | "female" | "total";
  employees: DrilldownEmployee[];
  meta: {
    generatedAt: string;
    resultCount: number;
  };
};

type DrilldownTarget = {
  section: "q39" | "q38";
  rowKey: string;
  rowLabel: string;
  sex: "male" | "female" | "total";
};

const FIELD_LABELS: Record<PivotField, string> = {
  employeeType: "Employee Type",
  eligibility: "Eligibility Type",
  supervisory: "Supervisory Level",
  gender: "Gender",
};

const numberFormatter = new Intl.NumberFormat("en-US");
const monthFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

type WorkforcePivotToolProps = {
  departmentId: string;
};

function formatSexLabel(value: DrilldownTarget["sex"]) {
  if (value === "male") return "Male";
  if (value === "female") return "Female";
  return "Total";
}

function renderFilterSummary(label: string, selectedCount: number, loading: boolean, fallback: string) {
  if (selectedCount) return `${selectedCount} selected`;
  if (loading) return "Loading...";
  return fallback;
}

export default function WorkforcePivotTool({ departmentId }: WorkforcePivotToolProps) {
  const { toast } = useToast();

  const [mode, setMode] = useState<PivotMode>("matrix");

  const [employeeTypeOptions, setEmployeeTypeOptions] = useState<Option[]>([]);
  const [eligibilityOptions, setEligibilityOptions] = useState<Option[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const [employeeTypeSearch, setEmployeeTypeSearch] = useState("");
  const [eligibilitySearch, setEligibilitySearch] = useState("");

  const [employeeTypeIds, setEmployeeTypeIds] = useState<string[]>([]);
  const [eligibilityIds, setEligibilityIds] = useState<string[]>([]);

  const [rowField, setRowField] = useState<PivotField>("supervisory");
  const [colField, setColField] = useState<PivotField>("gender");

  const [result, setResult] = useState<PivotResult | null>(null);
  const [cscResult, setCscResult] = useState<CscSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [drilldownTarget, setDrilldownTarget] = useState<DrilldownTarget | null>(null);
  const [drilldownSearch, setDrilldownSearch] = useState("");
  const [drilldownResult, setDrilldownResult] = useState<DrilldownResult | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const debounceTimer = useRef<number | null>(null);
  const drilldownTimer = useRef<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const activeDrilldownRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setOptionsLoading(true);
        const [employeeTypeRes, eligibilityRes] = await Promise.all([
          fetch(`/api/${departmentId}/employee_type`),
          fetch(`/api/${departmentId}/eligibility`),
        ]);
        if (!employeeTypeRes.ok) throw new Error(await employeeTypeRes.text());
        if (!eligibilityRes.ok) throw new Error(await eligibilityRes.text());
        const employeeTypeData = (await employeeTypeRes.json()) as Option[];
        const eligibilityData = (await eligibilityRes.json()) as Option[];
        if (!active) return;
        setEmployeeTypeOptions(
          employeeTypeData
            .filter(
              (item): item is Option =>
                typeof item?.id === "string" && typeof item?.name === "string"
            )
            .map((item) => ({ id: item.id, name: item.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEligibilityOptions(
          eligibilityData
            .filter(
              (item): item is Option =>
                typeof item?.id === "string" && typeof item?.name === "string"
            )
            .map((item) => ({ id: item.id, name: item.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (error) {
        if (!active) return;
        console.error("[workforce-pivot] options load error", error);
        toast({
          title: "Failed to load filter options",
          description: error instanceof Error ? error.message : "Something went wrong",
          variant: "destructive",
        });
      } finally {
        if (active) setOptionsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [departmentId, toast]);

  const employeeTypeSelectedSet = useMemo(() => new Set(employeeTypeIds), [employeeTypeIds]);
  const eligibilitySelectedSet = useMemo(() => new Set(eligibilityIds), [eligibilityIds]);

  const filteredEmployeeTypes = useMemo(() => {
    if (!employeeTypeSearch.trim()) return employeeTypeOptions;
    const query = employeeTypeSearch.toLowerCase();
    return employeeTypeOptions.filter((option) => option.name.toLowerCase().includes(query));
  }, [employeeTypeOptions, employeeTypeSearch]);

  const filteredEligibility = useMemo(() => {
    if (!eligibilitySearch.trim()) return eligibilityOptions;
    const query = eligibilitySearch.toLowerCase();
    return eligibilityOptions.filter((option) => option.name.toLowerCase().includes(query));
  }, [eligibilityOptions, eligibilitySearch]);

  const requestPayload = useMemo(
    () => ({
      employeeTypeIds,
      eligibilityIds,
    }),
    [eligibilityIds, employeeTypeIds]
  );

  const handleMatrixQuery = useCallback(async () => {
    if (activeRequest.current) {
      activeRequest.current.abort();
    }

    const controller = new AbortController();
    activeRequest.current = controller;

    setLoading(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-pivot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowField, colField, ...requestPayload }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as PivotResult;
      setResult(data);
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      console.error("[workforce-pivot] query error", error);
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : "Unable to complete the request",
        variant: "destructive",
      });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
      setLoading(false);
    }
  }, [colField, departmentId, requestPayload, rowField, toast]);

  const handleCscQuery = useCallback(async () => {
    if (activeRequest.current) {
      activeRequest.current.abort();
    }

    const controller = new AbortController();
    activeRequest.current = controller;

    setLoading(true);
    try {
      const response = await fetch(`/api/${departmentId}/analytics/workforce-pivot/csc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as CscSummaryResult;
      setCscResult(data);
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      console.error("[workforce-pivot] csc query error", error);
      toast({
        title: "Failed to load CSC report",
        description: error instanceof Error ? error.message : "Unable to complete the request",
        variant: "destructive",
      });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
      setLoading(false);
    }
  }, [departmentId, requestPayload, toast]);

  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      if (mode === "matrix") {
        void handleMatrixQuery();
      } else {
        void handleCscQuery();
      }
    }, AUTORUN_DEBOUNCE_MS) as unknown as number;

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [handleCscQuery, handleMatrixQuery, mode, rowField, colField, employeeTypeIds, eligibilityIds]);

  const handleReset = useCallback(() => {
    setEmployeeTypeIds([]);
    setEligibilityIds([]);
    setRowField("supervisory");
    setColField("gender");
    setEmployeeTypeSearch("");
    setEligibilitySearch("");
    setDrilldownSearch("");
  }, []);

  const handleRowFieldChange = useCallback(
    (value: PivotField) => {
      setRowField(value);
      if (value === colField) {
        const fallback = (Object.keys(FIELD_LABELS) as PivotField[]).find(
          (field) => field !== value
        );
        if (fallback) setColField(fallback);
      }
    },
    [colField]
  );

  const handleColFieldChange = useCallback(
    (value: PivotField) => {
      setColField(value);
      if (value === rowField) {
        const fallback = (Object.keys(FIELD_LABELS) as PivotField[]).find(
          (field) => field !== value
        );
        if (fallback) setRowField(fallback);
      }
    },
    [rowField]
  );

  const loadDrilldown = useCallback(async () => {
    if (!drilldownTarget) return;

    if (activeDrilldownRequest.current) {
      activeDrilldownRequest.current.abort();
    }

    const controller = new AbortController();
    activeDrilldownRequest.current = controller;

    setDrilldownLoading(true);
    try {
      const response = await fetch(
        `/api/${departmentId}/analytics/workforce-pivot/csc/drilldown`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestPayload,
            section: drilldownTarget.section,
            rowKey: drilldownTarget.rowKey,
            sex: drilldownTarget.sex,
            searchText: drilldownSearch,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as DrilldownResult;
      setDrilldownResult(data);
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") return;
      console.error("[workforce-pivot] drilldown error", error);
      toast({
        title: "Failed to load employee list",
        description: error instanceof Error ? error.message : "Unable to complete the request",
        variant: "destructive",
      });
    } finally {
      if (activeDrilldownRequest.current === controller) {
        activeDrilldownRequest.current = null;
      }
      setDrilldownLoading(false);
    }
  }, [departmentId, drilldownSearch, drilldownTarget, requestPayload, toast]);

  useEffect(() => {
    if (!drilldownTarget) {
      setDrilldownResult(null);
      setDrilldownSearch("");
      if (activeDrilldownRequest.current) {
        activeDrilldownRequest.current.abort();
        activeDrilldownRequest.current = null;
      }
      return;
    }

    if (drilldownTimer.current) window.clearTimeout(drilldownTimer.current);
    drilldownTimer.current = window.setTimeout(() => {
      void loadDrilldown();
    }, DRILLDOWN_DEBOUNCE_MS) as unknown as number;

    return () => {
      if (drilldownTimer.current) window.clearTimeout(drilldownTimer.current);
    };
  }, [drilldownTarget, drilldownSearch, loadDrilldown, employeeTypeIds, eligibilityIds]);

  useEffect(() => {
    return () => {
      if (activeRequest.current) activeRequest.current.abort();
      if (activeDrilldownRequest.current) activeDrilldownRequest.current.abort();
    };
  }, []);

  const openDrilldown = useCallback((target: DrilldownTarget) => {
    setDrilldownSearch("");
    setDrilldownResult(null);
    setDrilldownTarget(target);
  }, []);

  const renderMultiSelect = useCallback(
    ({
      label,
      selectedIds,
      selectedSet,
      options,
      filteredOptions,
      searchValue,
      onSearchChange,
      onSelectionChange,
      onClear,
      onSelectAll,
      fallbackLabel,
      emptyLabel,
    }: {
      label: string;
      selectedIds: string[];
      selectedSet: Set<string>;
      options: Option[];
      filteredOptions: Option[];
      searchValue: string;
      onSearchChange: (value: string) => void;
      onSelectionChange: (next: string[]) => void;
      onClear: () => void;
      onSelectAll: () => void;
      fallbackLabel: string;
      emptyLabel: string;
    }) => (
      <div className="space-y-3">
        <Label className="text-sm font-medium">{label}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-between" disabled={optionsLoading}>
              <span>
                {renderFilterSummary(label, selectedIds.length, optionsLoading, fallbackLabel)}
              </span>
              <span className="text-xs text-muted-foreground">Edit</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={8}>
            <div className="p-3 pb-2">
              <Input
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}`}
                className="h-9 sticky top-0 z-10 bg-background"
              />
            </div>
            <div className="max-h-80 overflow-y-auto border-t">
              <div className="space-y-1 p-2">
                {filteredOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{emptyLabel}</p>
                ) : (
                  filteredOptions.map((option) => {
                    const checked = selectedSet.has(option.id);
                    return (
                      <label
                        key={option.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(state) => {
                            const next = new Set(selectedIds);
                            if (state) next.add(option.id);
                            else next.delete(option.id);
                            onSelectionChange(Array.from(next));
                          }}
                        />
                        <span className="truncate">{option.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-xs">
              <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                Clear
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onSelectAll}
                disabled={options.length === 0}
              >
                Select all
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    ),
    [optionsLoading]
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-xl">Controls</CardTitle>
            <CardDescription>
              Switch between the flexible matrix pivot and the fixed CSC report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mode</Label>
              <Tabs value={mode} onValueChange={(value) => setMode(value as PivotMode)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="matrix">Matrix Pivot</TabsTrigger>
                  <TabsTrigger value="csc">CSC Report</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {mode === "matrix" ? (
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Rows</Label>
                  <Select
                    value={rowField}
                    onValueChange={(value) => handleRowFieldChange(value as PivotField)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIELD_LABELS) as PivotField[]).map((field) => (
                        <SelectItem key={field} value={field} disabled={field === colField}>
                          {FIELD_LABELS[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Columns</Label>
                  <Select
                    value={colField}
                    onValueChange={(value) => handleColFieldChange(value as PivotField)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(FIELD_LABELS) as PivotField[]).map((field) => (
                        <SelectItem key={field} value={field} disabled={field === rowField}>
                          {FIELD_LABELS[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {renderMultiSelect({
              label: "Employee Type filter",
              selectedIds: employeeTypeIds,
              selectedSet: employeeTypeSelectedSet,
              options: employeeTypeOptions,
              filteredOptions: filteredEmployeeTypes,
              searchValue: employeeTypeSearch,
              onSearchChange: setEmployeeTypeSearch,
              onSelectionChange: setEmployeeTypeIds,
              onClear: () => setEmployeeTypeIds([]),
              onSelectAll: () => setEmployeeTypeIds(employeeTypeOptions.map((option) => option.id)),
              fallbackLabel: "All employee types",
              emptyLabel: "No employee types found.",
            })}

            {renderMultiSelect({
              label: "Eligibility Type filter",
              selectedIds: eligibilityIds,
              selectedSet: eligibilitySelectedSet,
              options: eligibilityOptions,
              filteredOptions: filteredEligibility,
              searchValue: eligibilitySearch,
              onSearchChange: setEligibilitySearch,
              onSelectionChange: setEligibilityIds,
              onClear: () => setEligibilityIds([]),
              onSelectAll: () => setEligibilityIds(eligibilityOptions.map((option) => option.id)),
              fallbackLabel: "All eligibility types",
              emptyLabel: "No eligibility types found.",
            })}

            <div className="flex flex-wrap gap-3">
              {loading ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Updating...
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="flex items-center gap-2"
                onClick={handleReset}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {mode === "matrix" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {FIELD_LABELS[rowField]} x {FIELD_LABELS[colField]}
              </CardTitle>
              <CardDescription>
                {result
                  ? `${numberFormatter.format(result.grandTotal)} employees matched`
                  : "Adjust filters to populate the table."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result && result.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                          {FIELD_LABELS[rowField]}
                        </th>
                        {result.cols.map((col) => (
                          <th
                            key={col.key}
                            className="px-3 py-2 text-right font-semibold text-muted-foreground"
                          >
                            {col.name}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, rowIndex) => (
                        <tr key={row.key} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="px-3 py-2 font-medium">{row.name}</td>
                          {result.matrix[rowIndex].map((value, colIndex) => (
                            <td
                              key={result.cols[colIndex].key}
                              className="px-3 py-2 text-right tabular-nums"
                            >
                              {numberFormatter.format(value)}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right font-bold tabular-nums">
                            {numberFormatter.format(result.rowTotals[rowIndex])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td className="px-3 py-2 font-bold">Total</td>
                        {result.colTotals.map((value, colIndex) => (
                          <td
                            key={result.cols[colIndex].key}
                            className="px-3 py-2 text-right font-bold tabular-nums"
                          >
                            {numberFormatter.format(value)}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-bold tabular-nums">
                          {numberFormatter.format(result.grandTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No data available for the current filters.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CSC Workforce Report</CardTitle>
                <CardDescription>
                  {cscResult
                    ? `${numberFormatter.format(
                        cscResult.meta.matchedEmployeeCount
                      )} active employees matched the current filters`
                    : "Adjust filters to populate the report."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">Q3.9.</span> Number of
                    employees by job classification (career/non-career), class level, and sex.
                  </p>
                  <p className="mt-2">
                    <span className="font-semibold text-foreground">Q3.8.</span> Estimated
                    average length of service in months for selected employee types, by sex.
                  </p>
                </div>

                <CscCountTable
                  rows={cscResult?.q39.rows ?? []}
                  onOpenDrilldown={openDrilldown}
                />

                <CscAverageTable
                  rows={cscResult?.q38.rows ?? []}
                  onOpenDrilldown={openDrilldown}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(drilldownTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDrilldownTarget(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Employee Drilldown</DialogTitle>
            <DialogDescription>
              Verify which employees were counted for the selected CSC report cell.
            </DialogDescription>
          </DialogHeader>

          {drilldownTarget ? (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {drilldownTarget.section === "q39" ? "Q3.9 Count" : "Q3.8 Average"}
                </Badge>
                <Badge variant="outline">{drilldownTarget.rowLabel}</Badge>
                <Badge variant="outline">{formatSexLabel(drilldownTarget.sex)}</Badge>
              </div>

              <Input
                value={drilldownSearch}
                onChange={(event) => setDrilldownSearch(event.target.value)}
                placeholder="Search employee name, position, office, or employee type"
              />

              <div className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-4 py-3 text-sm">
                  <span className="font-medium">
                    {drilldownResult
                      ? `${numberFormatter.format(drilldownResult.meta.resultCount)} employees`
                      : "Loading employees"}
                  </span>
                  {drilldownLoading ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </span>
                  ) : null}
                </div>

                <div className="max-h-[50vh] overflow-auto">
                  {drilldownResult && drilldownResult.employees.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                            Employee
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                            Position
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                            Office
                          </th>
                          <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                            Employee Type
                          </th>
                          <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                            Service Months
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {drilldownResult.employees.map((employee) => (
                          <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="font-medium">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {employee.sex === "female" ? "Female" : "Male"} •{" "}
                                {employee.eligibilityName}
                              </div>
                            </td>
                            <td className="px-4 py-3">{employee.position}</td>
                            <td className="px-4 py-3">{employee.officeName}</td>
                            <td className="px-4 py-3">{employee.employeeTypeName}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {monthFormatter.format(employee.serviceMonths)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                      {drilldownLoading
                        ? "Loading employee list..."
                        : "No employees matched this report cell."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CscCountTable({
  rows,
  onOpenDrilldown,
}: {
  rows: CscCountRow[];
  onOpenDrilldown: (target: DrilldownTarget) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Q3.9 Number of employees by classification</h3>
        <p className="text-sm text-muted-foreground">
          Click any count to review the included employees.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Classification
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Male</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Female
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowKey} className="border-b last:border-0">
                <td className="px-4 py-3 align-top font-medium">{row.label}</td>
                {(["male", "female", "total"] as const).map((sex) => (
                  <td key={sex} className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-w-[72px] justify-end px-2 py-1 font-semibold tabular-nums"
                      onClick={() =>
                        onOpenDrilldown({
                          section: "q39",
                          rowKey: row.rowKey,
                          rowLabel: row.label,
                          sex,
                        })
                      }
                    >
                      {numberFormatter.format(row[sex])}
                    </Button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CscAverageTable({
  rows,
  onOpenDrilldown,
}: {
  rows: CscAverageRow[];
  onOpenDrilldown: (target: DrilldownTarget) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Q3.8 Estimated average service length</h3>
        <p className="text-sm text-muted-foreground">
          Values are shown in months and rounded for display. Click a value to inspect the
          employees behind it.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Employee Type
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Male</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">
                Female
              </th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowKey} className="border-b last:border-0">
                <td className="px-4 py-3 align-top font-medium">{row.label}</td>
                {(["male", "female", "total"] as const).map((sex) => (
                  <td key={sex} className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto min-w-[72px] justify-end px-2 py-1 font-semibold tabular-nums"
                      onClick={() =>
                        onOpenDrilldown({
                          section: "q38",
                          rowKey: row.rowKey,
                          rowLabel: row.label,
                          sex,
                        })
                      }
                    >
                      {monthFormatter.format(row[sex])}
                    </Button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
