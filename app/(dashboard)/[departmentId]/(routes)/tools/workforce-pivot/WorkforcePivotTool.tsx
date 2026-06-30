"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/components/ui/use-toast";

const AUTORUN_DEBOUNCE_MS = 350;

type Option = { id: string; name: string };
type PivotField = "employeeType" | "eligibility" | "supervisory" | "gender";
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

const FIELD_LABELS: Record<PivotField, string> = {
  employeeType: "Employee Type",
  eligibility: "Eligibility Type",
  supervisory: "Supervisory Level",
  gender: "Gender",
};

const numberFormatter = new Intl.NumberFormat("en-US");

type WorkforcePivotToolProps = {
  departmentId: string;
};

const WorkforcePivotTool = ({ departmentId }: WorkforcePivotToolProps) => {
  const { toast } = useToast();

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
  const [loading, setLoading] = useState(false);

  const debounceTimer = useRef<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

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
            .filter((item): item is Option => typeof item?.id === "string" && typeof item?.name === "string")
            .map((item) => ({ id: item.id, name: item.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setEligibilityOptions(
          eligibilityData
            .filter((item): item is Option => typeof item?.id === "string" && typeof item?.name === "string")
            .map((item) => ({ id: item.id, name: item.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (error) {
        if (active) {
          console.error("[workforce-pivot] options load error", error);
          toast({
            title: "Failed to load filter options",
            description: error instanceof Error ? error.message : "Something went wrong",
            variant: "destructive",
          });
        }
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

  const handleQuery = useCallback(async () => {
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
        body: JSON.stringify({ rowField, colField, employeeTypeIds, eligibilityIds }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as PivotResult;
      setResult(data);
    } catch (error) {
      if ((error as any)?.name !== "AbortError") {
        console.error("[workforce-pivot] query error", error);
        toast({
          title: "Query failed",
          description: error instanceof Error ? error.message : "Unable to complete the request",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
      activeRequest.current = null;
    }
  }, [colField, departmentId, eligibilityIds, employeeTypeIds, rowField, toast]);

  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      void handleQuery();
    }, AUTORUN_DEBOUNCE_MS) as unknown as number;
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowField, colField, employeeTypeIds, eligibilityIds]);

  const handleReset = useCallback(() => {
    setEmployeeTypeIds([]);
    setEligibilityIds([]);
    setRowField("supervisory");
    setColField("gender");
    setEmployeeTypeSearch("");
    setEligibilitySearch("");
  }, []);

  const handleRowFieldChange = useCallback(
    (value: PivotField) => {
      setRowField(value);
      if (value === colField) {
        const fallback = (Object.keys(FIELD_LABELS) as PivotField[]).find((field) => field !== value);
        if (fallback) setColField(fallback);
      }
    },
    [colField]
  );

  const handleColFieldChange = useCallback(
    (value: PivotField) => {
      setColField(value);
      if (value === rowField) {
        const fallback = (Object.keys(FIELD_LABELS) as PivotField[]).find((field) => field !== value);
        if (fallback) setRowField(fallback);
      }
    },
    [rowField]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-xl">Controls</CardTitle>
          <CardDescription>Pick what goes in rows/columns, then narrow with filters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Rows</Label>
              <Select value={rowField} onValueChange={(value) => handleRowFieldChange(value as PivotField)}>
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
              <Select value={colField} onValueChange={(value) => handleColFieldChange(value as PivotField)}>
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

          <div className="space-y-3">
            <Label className="text-sm font-medium">Employee Type filter</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={optionsLoading}>
                  <span>
                    {employeeTypeIds.length
                      ? `${employeeTypeIds.length} selected`
                      : optionsLoading
                        ? "Loading..."
                        : "All employee types"}
                  </span>
                  <span className="text-xs text-muted-foreground">Edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={8}>
                <div className="p-3 pb-2">
                  <Input
                    value={employeeTypeSearch}
                    onChange={(event) => setEmployeeTypeSearch(event.target.value)}
                    placeholder="Search employee types"
                    className="h-9 sticky top-0 z-10 bg-background"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto border-t">
                  <div className="space-y-1 p-2">
                    {filteredEmployeeTypes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No employee types found.</p>
                    ) : (
                      filteredEmployeeTypes.map((option) => {
                        const checked = employeeTypeSelectedSet.has(option.id);
                        return (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => {
                                setEmployeeTypeIds((prev) => {
                                  const next = new Set(prev);
                                  if (state) next.add(option.id);
                                  else next.delete(option.id);
                                  return Array.from(next);
                                });
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
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEmployeeTypeIds([])}>
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEmployeeTypeIds(employeeTypeOptions.map((option) => option.id))}
                    disabled={employeeTypeOptions.length === 0}
                  >
                    Select all
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Eligibility Type filter</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={optionsLoading}>
                  <span>
                    {eligibilityIds.length
                      ? `${eligibilityIds.length} selected`
                      : optionsLoading
                        ? "Loading..."
                        : "All eligibility types"}
                  </span>
                  <span className="text-xs text-muted-foreground">Edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={8}>
                <div className="p-3 pb-2">
                  <Input
                    value={eligibilitySearch}
                    onChange={(event) => setEligibilitySearch(event.target.value)}
                    placeholder="Search eligibility types"
                    className="h-9 sticky top-0 z-10 bg-background"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto border-t">
                  <div className="space-y-1 p-2">
                    {filteredEligibility.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No eligibility types found.</p>
                    ) : (
                      filteredEligibility.map((option) => {
                        const checked = eligibilitySelectedSet.has(option.id);
                        return (
                          <label
                            key={option.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => {
                                setEligibilityIds((prev) => {
                                  const next = new Set(prev);
                                  if (state) next.add(option.id);
                                  else next.delete(option.id);
                                  return Array.from(next);
                                });
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
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEligibilityIds([])}>
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEligibilityIds(eligibilityOptions.map((option) => option.id))}
                    disabled={eligibilityOptions.length === 0}
                  >
                    Select all
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-wrap gap-3">
            {loading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating…
              </div>
            ) : null}
            <Button type="button" variant="ghost" className="flex items-center gap-2" onClick={handleReset} disabled={loading}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {FIELD_LABELS[rowField]} × {FIELD_LABELS[colField]}
          </CardTitle>
          <CardDescription>
            {result ? `${numberFormatter.format(result.grandTotal)} employees matched` : "Adjust filters to populate the table."}
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
                      <th key={col.key} className="px-3 py-2 text-right font-semibold text-muted-foreground">
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
                        <td key={result.cols[colIndex].key} className="px-3 py-2 text-right tabular-nums">
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
                      <td key={result.cols[colIndex].key} className="px-3 py-2 text-right font-bold tabular-nums">
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
            <p className="text-sm text-muted-foreground">No data available for the current filters.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkforcePivotTool;
