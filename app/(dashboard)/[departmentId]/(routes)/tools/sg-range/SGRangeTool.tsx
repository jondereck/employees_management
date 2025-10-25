"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Loader2, RefreshCw, Link as LinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import type { HeadsMode, SGRangeResult } from "@/types/sgRange";
// Fetch reference salaries from DB via API (step 1 per grade)

const MIN_SG = 1;
const MAX_SG = 33;
const STORAGE_KEY = "hrps.sgRange.v1";
const SESSION_CACHE_KEY = "hrps.sgRange.cache.v1";
const AUTORUN_DEBOUNCE_MS = 400;

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

type Option = { id: string; name: string };
type ControlsState = {
  range: [number, number];
  offices: string[];
  employmentTypes: string[];
  headsMode: HeadsMode; // kept in state for API compatibility, but UI removed
  dateFrom: string | null;
  dateTo: string | null;
  includeUnknown: boolean;
};

type ChartPoint = {
  sg: number;
  count: number;
  sumSalary: number;
  inRange: boolean;
};

const DEFAULT_CONTROLS: ControlsState = {
  range: [1, 10],
  offices: [],
  employmentTypes: [],
  headsMode: "all",
  dateFrom: null,
  dateTo: null,
  includeUnknown: false,
};

const clampRangeValue = (value: number) => {
  if (!Number.isFinite(value)) return MIN_SG;
  return Math.min(MAX_SG, Math.max(MIN_SG, Math.trunc(value)));
};

const readStoredState = (): ControlsState | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ControlsState & { range: [number, number] }>;
    if (!parsed) return null;
    const range: [number, number] = Array.isArray(parsed.range) && parsed.range.length === 2
      ? [clampRangeValue(parsed.range[0]), clampRangeValue(parsed.range[1])]
      : DEFAULT_CONTROLS.range;
    const [L, R] = range[0] > range[1] ? [range[1], range[0]] : range;
    return {
      range: [L, R],
      offices: Array.isArray(parsed.offices) ? parsed.offices.filter((id): id is string => typeof id === "string") : [],
      employmentTypes: Array.isArray(parsed.employmentTypes)
        ? parsed.employmentTypes.filter((id): id is string => typeof id === "string")
        : [],
      headsMode: parsed.headsMode === "headsOnly" ? "headsOnly" : "all",
      dateFrom: typeof parsed.dateFrom === "string" && parsed.dateFrom ? parsed.dateFrom : null,
      dateTo: typeof parsed.dateTo === "string" && parsed.dateTo ? parsed.dateTo : null,
      includeUnknown: Boolean(parsed.includeUnknown),
    };
  } catch (error) {
    console.warn("[sg-range] failed to parse stored state", error);
    return null;
  }
};

const parseSearchParams = (search: URLSearchParams): ControlsState | null => {
  const hasParams = Array.from(search.keys()).length > 0;
  if (!hasParams) return null;
  const L = clampRangeValue(Number(search.get("L")) || DEFAULT_CONTROLS.range[0]);
  const R = clampRangeValue(Number(search.get("R")) || DEFAULT_CONTROLS.range[1]);
  const range: [number, number] = L > R ? [R, L] : [L, R];
  const headsParam = search.get("heads") === "headsOnly" ? "headsOnly" : "all";
  const offices = search.getAll("offices");
  const employmentTypes = search.getAll("employmentTypes");
  const dateFrom = search.get("dateFrom");
  const dateTo = search.get("dateTo");
  const includeUnknownParam = search.get("includeUnknown");
  return {
    range,
    offices,
    employmentTypes,
    headsMode: headsParam,
    dateFrom: dateFrom && dateFrom.length >= 8 ? dateFrom : null,
    dateTo: dateTo && dateTo.length >= 8 ? dateTo : null,
    includeUnknown: includeUnknownParam === "1" || includeUnknownParam === "true",
  };
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDateLabel = (value: string | null) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  } catch {
    return value;
  }
};

const buildQueryString = (controls: ControlsState) => {
  const params = new URLSearchParams();
  params.set("L", String(controls.range[0]));
  params.set("R", String(controls.range[1]));
  if (controls.headsMode === "headsOnly") {
    params.set("heads", "headsOnly");
  }
  controls.offices.forEach((id) => params.append("offices", id));
  controls.employmentTypes.forEach((id) => params.append("employmentTypes", id));
  if (controls.dateFrom) params.set("dateFrom", controls.dateFrom);
  if (controls.dateTo) params.set("dateTo", controls.dateTo);
  if (controls.includeUnknown) params.set("includeUnknown", "1");
  return params.toString();
};

type SGRangeToolProps = {
  departmentId: string;
};

const SGRangeTool = ({ departmentId }: SGRangeToolProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [result, setResult] = useState<SGRangeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [offices, setOffices] = useState<Option[]>([]);
  const [employmentOptions, setEmploymentOptions] = useState<Option[]>([]);
  const [officesLoading, setOfficesLoading] = useState(false);
  const [employmentLoading, setEmploymentLoading] = useState(false);
  const [officesSearch, setOfficesSearch] = useState("");
  const [employmentSearch, setEmploymentSearch] = useState("");
  const [initialized, setInitialized] = useState(false);
  const debounceTimer = useRef<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);

  const setRangeNormalized = useCallback((nextL: number, nextR: number) => {
    let L = clampRangeValue(nextL);
    let R = clampRangeValue(nextR);
    if (L > R) {
      [L, R] = [R, L];
    }
    setControls((prev) => ({ ...prev, range: [L, R] }));
  }, []);

  useEffect(() => {
    if (initialized) return;
    if (typeof window === "undefined") return;

    const searchState = parseSearchParams(new URLSearchParams(window.location.search));
    if (searchState) {
      setControls({ ...DEFAULT_CONTROLS, ...searchState });
      setInitialized(true);
      return;
    }

    const stored = readStoredState();
    if (stored) {
      setControls({ ...DEFAULT_CONTROLS, ...stored });
    }
    setInitialized(true);
  }, [initialized]);

  // Moved below after handleQuery definition (see bottom of file)

  const handleCopyLink = useCallback(async () => {
    try {
      const qs = buildQueryString(controls);
      const url = `${window.location.origin}${pathname}?${qs}`;
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Current filters copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Could not copy link.", variant: "destructive" });
    }
  }, [controls, pathname, toast]);

  useEffect(() => {
    let active = true;

    const loadOffices = async () => {
      try {
        setOfficesLoading(true);
        const response = await fetch(`/api/${departmentId}/offices`);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as Option[];
        if (!active) return;
        setOffices(
          data
            .filter((item): item is Option => typeof item?.id === "string" && typeof item?.name === "string")
            .map((item) => ({ id: item.id, name: item.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (error) {
        if (active) {
          console.error("[sg-range] offices load error", error);
          toast({
            title: "Failed to load offices",
            description: error instanceof Error ? error.message : "Something went wrong",
            variant: "destructive",
          });
        }
      } finally {
        if (active) setOfficesLoading(false);
      }
    };

    const loadEmploymentTypes = async () => {
      try {
        setEmploymentLoading(true);
        const response = await fetch(`/api/${departmentId}/employee_type`);
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as Option[];
        if (!active) return;
        setEmploymentOptions(
          data
            .filter((item): item is Option => typeof item?.id === "string" && typeof item?.name === "string")
            .map((item) => ({ id: item.id, name: item.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (error) {
        if (active) {
          console.error("[sg-range] employment types load error", error);
          toast({
            title: "Failed to load employment types",
            description: error instanceof Error ? error.message : "Something went wrong",
            variant: "destructive",
          });
        }
      } finally {
        if (active) setEmploymentLoading(false);
      }
    };

    loadOffices();
    loadEmploymentTypes();

    return () => {
      active = false;
    };
  }, [departmentId, toast]);

  const officesSelectedSet = useMemo(() => new Set(controls.offices), [controls.offices]);
  const employmentSelectedSet = useMemo(() => new Set(controls.employmentTypes), [controls.employmentTypes]);

  const filteredOffices = useMemo(() => {
    if (!officesSearch.trim()) return offices;
    const query = officesSearch.toLowerCase();
    return offices.filter((office) => office.name.toLowerCase().includes(query));
  }, [offices, officesSearch]);

  const filteredEmployment = useMemo(() => {
    if (!employmentSearch.trim()) return employmentOptions;
    const query = employmentSearch.toLowerCase();
    return employmentOptions.filter((option) => option.name.toLowerCase().includes(query));
  }, [employmentOptions, employmentSearch]);

  const officeNameMap = useMemo(() => new Map(offices.map((office) => [office.id, office.name])), [offices]);
  const employmentNameMap = useMemo(
    () => new Map(employmentOptions.map((option) => [option.id, option.name])),
    [employmentOptions]
  );

  const chartData: ChartPoint[] = useMemo(() => {
    const buckets = result?.perSG ?? [];
    const bucketMap = new Map<number, { count: number; sumSalary: number }>();
    for (const bucket of buckets) {
      bucketMap.set(bucket.sg, { count: bucket.count, sumSalary: bucket.sumSalary });
    }
    const data: ChartPoint[] = [];
    for (let sg = MIN_SG; sg <= MAX_SG; sg += 1) {
      const bucket = bucketMap.get(sg) ?? { count: 0, sumSalary: 0 };
      data.push({
        sg,
        count: bucket.count,
        sumSalary: bucket.sumSalary,
        inRange: sg >= controls.range[0] && sg <= controls.range[1],
      });
    }
    return data;
  }, [controls.range, result?.perSG]);

  const [refSalaries, setRefSalaries] = useState<Record<number, number> | null>(null);

  useEffect(() => {
    let active = true;
    const KEY = "sgRef.v1";
    const fromSession = typeof window !== "undefined" ? sessionStorage.getItem(KEY) : null;
    if (fromSession) {
      try { setRefSalaries(JSON.parse(fromSession)); } catch {}
    }
    (async () => {
      try {
        const res = await fetch(`/api/${departmentId}/salary-grades`);
        if (!res.ok) return;
        const data = (await res.json()) as Record<number, number>;
        if (!active) return;
        setRefSalaries(data);
        try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch {}
      } catch {}
    })();
    return () => { active = false; };
  }, [departmentId]);

  const tableRows = useMemo(() => {
    if (!result) return [];
    return result.perSG.map((bucket) => ({
      sg: bucket.sg,
      label: bucket.sg === 0 ? "Unknown" : `SG ${bucket.sg}`,
      count: bucket.count,
      sumSalary: bucket.sumSalary,
      avgSalary: bucket.count ? bucket.sumSalary / bucket.count : 0,
      reference: refSalaries?.[bucket.sg] ?? null,
    }));
  }, [result, refSalaries]);

  const unknownBucket = result?.perSG.find((bucket) => bucket.sg === 0);
  const unknownCount = unknownBucket?.count ?? 0;
  const unknownSum = unknownBucket?.sumSalary ?? 0;

  const baseCount = result?.count ?? 0;
  const baseSum = result?.sumSalary ?? 0;

  const displayCount = controls.includeUnknown ? baseCount + unknownCount : baseCount;
  const displaySum = controls.includeUnknown ? baseSum + unknownSum : baseSum;
  const displayAvg = displayCount ? displaySum / displayCount : 0;

  const employeesSubtitle = controls.includeUnknown
    ? `SG ${controls.range[0]} - ${controls.range[1]} + unknown`
    : `SG ${controls.range[0]} - ${controls.range[1]}`;

  const optionsLoading = officesLoading || employmentLoading;

  const handleQuery = useCallback(async () => {
    const payload = {
      L: controls.range[0],
      R: controls.range[1],
      filters: {
        officeIds: controls.offices,
        headsMode: controls.headsMode,
        employmentTypes: controls.employmentTypes,
        dateFrom: controls.dateFrom ?? undefined,
        dateTo: controls.dateTo ?? undefined,
        includeUnknownSG: controls.includeUnknown,
      },
    };

    // Abort and create controller for this request
    if (activeRequest.current) {
      activeRequest.current.abort();
    }
    const controller = new AbortController();
    activeRequest.current = controller;

    setLoading(true);
    try {
      // Show cached result first (stale-while-revalidate)
      const qsCache = buildQueryString(controls);
      const cacheKey = `${SESSION_CACHE_KEY}:${qsCache}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) setResult(JSON.parse(cached) as SGRangeResult);
      } catch {}

      const response = await fetch(`/api/${departmentId}/analytics/sg-range`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to run query");
      }
      const data = (await response.json()) as SGRangeResult;
      setResult(data);
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}

      const queryString = buildQueryString(controls);
      if (typeof window !== "undefined") {
        const stored = {
          range: controls.range,
          offices: controls.offices,
          employmentTypes: controls.employmentTypes,
          headsMode: controls.headsMode,
          dateFrom: controls.dateFrom,
          dateTo: controls.dateTo,
          includeUnknown: controls.includeUnknown,
        } satisfies ControlsState;
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch (error) {
          console.warn("[sg-range] failed to persist controls", error);
        }
      }
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    } catch (error) {
      if ((error as any)?.name !== "AbortError") {
        console.error("[sg-range] query error", error);
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
  }, [controls, departmentId, pathname, router, toast]);

  const handleReset = useCallback(() => {
    setControls(DEFAULT_CONTROLS);
    setResult(null);
    setOfficesSearch("");
    setEmploymentSearch("");
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn("[sg-range] failed to clear storage", error);
      }
    }
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const renderTooltip = useCallback(
    ({ active, payload, label }: TooltipProps<number, string>) => {
      if (!active || !payload?.length) {
        return null;
      }
      const entry = payload[0]?.payload as ChartPoint | undefined;
      if (!entry) return null;
      return (
        <div className="rounded-md border bg-background p-3 text-xs shadow">
          <p className="font-medium">SG {label}</p>
          <p>Count: {numberFormatter.format(entry.count)}</p>
          <p>Total salary: {currencyFormatter.format(entry.sumSalary)}</p>
        </div>
      );
    },
    []
  );

  // Persist changes, update URL, and debounce query (after handleQuery exists)
  useEffect(() => {
    if (!initialized) return;
    const qs = buildQueryString(controls);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controls)); } catch {}
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => { void handleQuery(); }, AUTORUN_DEBOUNCE_MS) as unknown as number;
    return () => { if (debounceTimer.current) window.clearTimeout(debounceTimer.current); };
  }, [controls, initialized, pathname, router, handleQuery]);

  const handleExportCSV = useCallback(() => {
    if (!result) return;
    const header = "SG,Count,TotalSalary,AvgSalary";
    const rows = result.perSG.map((bucket) => {
      const avg = bucket.count ? bucket.sumSalary / bucket.count : 0;
      return `${bucket.sg},${bucket.count},${bucket.sumSalary},${avg}`;
    });
    const blob = new Blob([header, "\n", rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    downloadBlob(blob, `sg-range-${controls.range[0]}-${controls.range[1]}.csv`);
  }, [controls.range, result]);

  const handleExportXLSX = useCallback(() => {
    if (!result) return;
    const workbook = XLSX.utils.book_new();
    const perSgSheet = XLSX.utils.json_to_sheet(
      result.perSG.map((bucket) => ({
        SG: bucket.sg,
        Count: bucket.count,
        TotalSalary: Number(bucket.sumSalary.toFixed(2)),
        AvgSalary: Number((bucket.count ? bucket.sumSalary / bucket.count : 0).toFixed(2)),
      })),
      { header: ["SG", "Count", "TotalSalary", "AvgSalary"] }
    );

    const summaryData = [
      ["Metric", "Value"],
      ["Range", `SG ${controls.range[0]}–${controls.range[1]}`],
      ["Heads", controls.headsMode === "headsOnly" ? "Heads only" : "All"],
      [
        "Offices",
        controls.offices.length
          ? controls.offices.map((id) => officeNameMap.get(id) ?? id).join(", ")
          : "All",
      ],
      [
        "Employment types",
        controls.employmentTypes.length
          ? controls.employmentTypes.map((id) => employmentNameMap.get(id) ?? id).join(", ")
          : "All",
      ],
      ["Hire date from", formatDateLabel(controls.dateFrom)],
      ["Hire date to", formatDateLabel(controls.dateTo)],
      ["Include unknown SG", controls.includeUnknown ? "Yes" : "No"],
      [
        "Query total",
        result.count
          ? `${numberFormatter.format(result.count)} employees · ${currencyFormatter.format(result.sumSalary)}`
          : "0",
      ],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

    XLSX.utils.book_append_sheet(workbook, perSgSheet, "Per SG");
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `sg-range-${controls.range[0]}-${controls.range[1]}.xlsx`);
  }, [controls, employmentNameMap, officeNameMap, result]);

  const queryDisabled = loading || optionsLoading;

  // Auto-run query when controls change, and persist to localStorage
  useEffect(() => {
    if (!initialized) return;
    const qs = buildQueryString(controls);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
    const url = `${pathname}?${qs}`;
    router.replace(url);
    // Trigger query on every change
    void (async () => {
      await handleQuery();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, initialized]);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-xl">Controls</CardTitle>
          <CardDescription>Configure the SG window and filters, then run a query.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">SG Range</Label>
              <span className="text-sm text-muted-foreground">{`SG ${controls.range[0]} – ${controls.range[1]}`}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[[1,10],[11,20],[21,33]].map(([L,R]) => (
                <Button key={`${L}-${R}`} size="sm" variant="outline" onClick={() => setRangeNormalized(L,R)}>
                  {`SG ${L}–${R}`}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={MIN_SG}
                max={MAX_SG}
                value={controls.range[0]}
                onChange={(event) => setRangeNormalized(Number(event.target.value), controls.range[1])}
                aria-label="Range start"
              />
              <Input
                type="number"
                min={MIN_SG}
                max={MAX_SG}
                value={controls.range[1]}
                onChange={(event) => setRangeNormalized(controls.range[0], Number(event.target.value))}
                aria-label="Range end"
              />
            </div>
            <Slider
              min={MIN_SG}
              max={MAX_SG}
              step={1}
              value={controls.range}
              onValueChange={([min, max]) => setRangeNormalized(min ?? MIN_SG, max ?? MAX_SG)}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Offices</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={optionsLoading}>
                  <span>
                    {controls.offices.length
                      ? `${controls.offices.length} selected`
                      : optionsLoading
                        ? "Loading..."
                        : "All offices"}
                  </span>
                  <span className="text-xs text-muted-foreground">Edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={8}>
                <div className="p-3 pb-2">
                <Input
                  value={officesSearch}
                  onChange={(event) => setOfficesSearch(event.target.value)}
                  placeholder="Search offices"
                  className="h-9 sticky top-0 z-10 bg-background"
                />
                </div>
                <div className="max-h-80 overflow-y-auto border-t">
                  <div className="space-y-1 p-2">
                    {filteredOffices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No offices found.</p>
                    ) : (
                      filteredOffices.map((office) => {
                        const checked = officesSelectedSet.has(office.id);
                        return (
                          <label
                            key={office.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => {
                                setControls((prev) => {
                                  const next = new Set(prev.offices);
                                  if (state) {
                                    next.add(office.id);
                                  } else {
                                    next.delete(office.id);
                                  }
                                  return { ...prev, offices: Array.from(next) };
                                });
                              }}
                            />
                            <span className="truncate">{office.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setControls((prev) => ({ ...prev, offices: [] }))}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setControls((prev) => ({ ...prev, offices: offices.map((office) => office.id) }))}
                    disabled={offices.length === 0}
                  >
                    Select all
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Heads filter removed per request */}

          <div className="space-y-3">
            <Label className="text-sm font-medium">Employment types</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" disabled={optionsLoading}>
                  <span>
                    {controls.employmentTypes.length
                      ? `${controls.employmentTypes.length} selected`
                      : optionsLoading
                        ? "Loading..."
                        : "All types"}
                  </span>
                  <span className="text-xs text-muted-foreground">Edit</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" side="bottom" sideOffset={8}>
                <div className="p-3 pb-2">
                <Input
                  value={employmentSearch}
                  onChange={(event) => setEmploymentSearch(event.target.value)}
                  placeholder="Search types"
                  className="h-9 sticky top-0 z-10 bg-background"
                />
                </div>
                <div className="max-h-80 overflow-y-auto border-t">
                  <div className="space-y-1 p-2">
                    {filteredEmployment.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No employment types found.</p>
                    ) : (
                      filteredEmployment.map((type) => {
                        const checked = employmentSelectedSet.has(type.id);
                        return (
                          <label
                            key={type.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) => {
                                setControls((prev) => {
                                  const next = new Set(prev.employmentTypes);
                                  if (state) {
                                    next.add(type.id);
                                  } else {
                                    next.delete(type.id);
                                  }
                                  return { ...prev, employmentTypes: Array.from(next) };
                                });
                              }}
                            />
                            <span className="truncate">{type.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2 text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setControls((prev) => ({ ...prev, employmentTypes: [] }))}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setControls((prev) => ({ ...prev, employmentTypes: employmentOptions.map((type) => type.id) }))
                    }
                    disabled={employmentOptions.length === 0}
                  >
                    Select all
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium" htmlFor="hire-date-from">
                Hire date from
              </Label>
              <Input
                id="hire-date-from"
                type="date"
                value={controls.dateFrom ?? ""}
                onChange={(event) => {
                  const value = event.target.value || null;
                  setControls((prev) => {
                    let dateFrom = value;
                    let dateTo = prev.dateTo;
                    if (dateFrom && dateTo && dateFrom > dateTo) {
                      dateTo = dateFrom;
                    }
                    return { ...prev, dateFrom, dateTo };
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium" htmlFor="hire-date-to">
                Hire date to
              </Label>
              <Input
                id="hire-date-to"
                type="date"
                value={controls.dateTo ?? ""}
                onChange={(event) => {
                  const value = event.target.value || null;
                  setControls((prev) => {
                    let dateTo = value;
                    let dateFrom = prev.dateFrom;
                    if (dateFrom && dateTo && dateTo < dateFrom) {
                      dateFrom = dateTo;
                    }
                    return { ...prev, dateFrom, dateTo };
                  });
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="include-unknown" className="text-sm font-medium">
                Include SG unknown (0)
              </Label>
              <p className="text-xs text-muted-foreground">Adds employees without SG into an SG 0 bucket.</p>
            </div>
            <Switch
              id="include-unknown"
              checked={controls.includeUnknown}
              onCheckedChange={(state) => setControls((prev) => ({ ...prev, includeUnknown: Boolean(state) }))}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {loading ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Updating…
              </div>
            ) : null}
            <Button type="button" variant="outline" className="flex items-center gap-2" onClick={handleCopyLink}>
              <LinkIcon className="h-4 w-4" aria-hidden="true" />
              Copy link
            </Button>
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

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Employees in range</CardDescription>
              <CardTitle className="text-3xl font-semibold">
                {result ? numberFormatter.format(displayCount) : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {employeesSubtitle}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total salary</CardDescription>
              <CardTitle className="text-3xl font-semibold">
                {result ? currencyFormatter.format(displaySum) : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Sum of monthly salaries in range
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average salary</CardDescription>
              <CardTitle className="text-3xl font-semibold">
                {result ? currencyFormatter.format(displayAvg || 0) : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {result
                ? `${numberFormatter.format(displayCount)} employees${controls.includeUnknown ? " (incl. unknown)" : ""}`
                : "Awaiting results"}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribution by SG (count)</CardTitle>
            <CardDescription>Bars highlight the selected SG window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="sg" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={renderTooltip} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.sg}
                        fill={entry.inRange ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Breakdown by SG</CardTitle>
              <CardDescription>
                Compare actual totals vs. reference salary per grade.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={!result}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportXLSX}
                disabled={!result}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                XLSX
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">SG</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Total salary</TableHead>
                    <TableHead>Avg salary (actual)</TableHead>
                    <TableHead>SG reference salary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((row) => (
                    <TableRow key={row.sg} className={row.sg >= controls.range[0] && row.sg <= controls.range[1] ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell>{numberFormatter.format(row.count)}</TableCell>
                      <TableCell>{currencyFormatter.format(row.sumSalary)}</TableCell>
                      <TableCell>{currencyFormatter.format(row.avgSalary || 0)}</TableCell>
                      <TableCell>{row.reference ? currencyFormatter.format(row.reference) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {result ? null : null}
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Adjust filters to populate the table.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SGRangeTool;
