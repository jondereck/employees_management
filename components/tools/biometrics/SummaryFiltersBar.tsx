"use client";

import { useMemo } from "react";
import { Filter, Layers, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import {
  type HeadsFilterValue,
  type SummarySortField,
  type SummarySortSelection,
  useSummaryFilters,
} from "@/hooks/use-summary-filters";

export type SummaryFiltersBarOfficeOption = {
  key: string;
  label: string;
  count: number;
};

export type SummaryFiltersBarProps = {
  officeOptions: SummaryFiltersBarOfficeOption[];
  scheduleOptions: string[];
};

const HEAD_OPTIONS: { label: string; value: HeadsFilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Heads only", value: "heads" },
  { label: "Exclude heads", value: "nonHeads" },
];

const SORT_DIRECTION_OPTIONS = [
  { label: "Descending", value: "desc" },
  { label: "Ascending", value: "asc" },
] as const;

const SORT_FIELD_LABELS: Record<SummarySortField, string> = {
  lateMetric: "Late metric",
  undertimeMetric: "Undertime metric",
  lateDays: "Late days",
  undertimeDays: "Undertime days",
  daysWithLogs: "Evaluated days",
  noPunchDays: "No-punch days",
};

const renderSortLabel = (field: SummarySortField, metricMode: "days" | "minutes") => {
  if (field === "lateMetric") {
    return metricMode === "minutes" ? "Late (minutes)" : "Late %";
  }
  if (field === "undertimeMetric") {
    return metricMode === "minutes" ? "Undertime (minutes)" : "Undertime %";
  }
  return SORT_FIELD_LABELS[field];
};

const SummaryFiltersBar = ({ officeOptions, scheduleOptions }: SummaryFiltersBarProps) => {
  const {
    filters,
    setSearch,
    setHeads,
    setMetricMode,
    setShowUnmatched,
    setShowNoPunchColumn,
    toggleOffice,
    setOffices,
    toggleSchedule,
    setSchedules,
    setSortPrimary,
    setSortSecondary,
  } = useSummaryFilters();

  const sortedOfficeOptions = useMemo(
    () => [...officeOptions].sort((a, b) => a.label.localeCompare(b.label)),
    [officeOptions]
  );
  const sortedScheduleOptions = useMemo(
    () => [...scheduleOptions].sort((a, b) => a.localeCompare(b)),
    [scheduleOptions]
  );

  const handlePrimaryFieldChange = (value: SummarySortField) => {
    setSortPrimary({ field: value, direction: filters.sort.primary.direction });
  };

  const handlePrimaryDirectionChange = (value: "asc" | "desc") => {
    setSortPrimary({ field: filters.sort.primary.field, direction: value });
  };

  const handleSecondaryFieldChange = (value: SummarySortField | "none") => {
    if (value === "none") {
      setSortSecondary(null);
      return;
    }
    const next: SummarySortSelection = {
      field: value,
      direction: filters.sort.secondary?.direction ?? "desc",
    };
    setSortSecondary(next);
  };

  const handleSecondaryDirectionChange = (value: "asc" | "desc") => {
    if (!filters.sort.secondary) {
      setSortSecondary({ field: filters.sort.primary.field, direction: value });
      return;
    }
    setSortSecondary({ field: filters.sort.secondary.field, direction: value });
  };

  const sortFieldOptions = useMemo(() => {
    return (Object.keys(SORT_FIELD_LABELS) as SummarySortField[]).map((key) => ({
      value: key,
      label: renderSortLabel(key, filters.metricMode),
    }));
  }, [filters.metricMode]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 p-3 text-sm shadow-sm">
      <div className="relative min-w-[220px] flex-1 sm:flex-none">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name / employee # / token"
          className="pl-8"
        />
      </div>

      <ToggleGroup
        type="single"
        value={filters.heads}
        onValueChange={(value) => {
          if (value === "heads" || value === "nonHeads" || value === "all") {
            setHeads(value);
          }
        }}
        className="inline-flex overflow-hidden rounded-md border"
        size="sm"
        aria-label="Filter by head status"
      >
        {HEAD_OPTIONS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={cn("px-2", filters.heads === option.value ? "font-semibold" : undefined)}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="inline-flex items-center gap-2">
            <Filter className="h-4 w-4" aria-hidden="true" />
            {filters.offices.length ? `Offices (${filters.offices.length})` : "Offices"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start" sideOffset={8}>
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium">Select offices</p>
            {filters.offices.length ? (
              <Button variant="ghost" size="sm" onClick={() => setOffices([])}>
                Clear
              </Button>
            ) : null}
          </div>
          <ScrollArea className="h-56 pr-2">
            <div className="space-y-2">
              {sortedOfficeOptions.map((option) => (
                <label key={option.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.offices.includes(option.key)}
                      onCheckedChange={(checked) => toggleOffice(option.key, Boolean(checked))}
                    />
                    {option.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{option.count}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="inline-flex items-center gap-2">
            <Layers className="h-4 w-4" aria-hidden="true" />
            {filters.schedules.length ? `Schedules (${filters.schedules.length})` : "Schedules"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60" align="start" sideOffset={8}>
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-medium">Schedule types</p>
            {filters.schedules.length ? (
              <Button variant="ghost" size="sm" onClick={() => setSchedules([])}>
                Clear
              </Button>
            ) : null}
          </div>
          <ScrollArea className="h-48 pr-2">
            <div className="space-y-2">
              {sortedScheduleOptions.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={filters.schedules.includes(option)}
                    onCheckedChange={(checked) => toggleSchedule(option, Boolean(checked))}
                  />
                  {option}
                </label>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-2">
        <Switch
          id="summary-show-unmatched"
          checked={filters.showUnmatched}
          onCheckedChange={(checked) => setShowUnmatched(Boolean(checked))}
        />
        <Label htmlFor="summary-show-unmatched" className="text-sm text-muted-foreground">
          Show unmatched
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="summary-show-no-punch"
          checked={filters.showNoPunchColumn}
          onCheckedChange={(checked) => setShowNoPunchColumn(Boolean(checked))}
        />
        <Label htmlFor="summary-show-no-punch" className="text-sm text-muted-foreground">
          Show no-punch column
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">View</span>
        <div className="inline-flex overflow-hidden rounded-md border">
          <Button
            type="button"
            variant={filters.metricMode === "days" ? "default" : "ghost"}
            size="sm"
            className="rounded-none"
            aria-pressed={filters.metricMode === "days"}
            onClick={() => setMetricMode("days")}
          >
            Days
          </Button>
          <Button
            type="button"
            variant={filters.metricMode === "minutes" ? "default" : "ghost"}
            size="sm"
            className="rounded-none"
            aria-pressed={filters.metricMode === "minutes"}
            onClick={() => setMetricMode("minutes")}
          >
            Minutes
          </Button>
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Sort
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end" sideOffset={8}>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Primary sort</p>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={filters.sort.primary.field}
                  onValueChange={(value) => handlePrimaryFieldChange(value as SummarySortField)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.sort.primary.direction}
                  onValueChange={(value) => handlePrimaryDirectionChange(value as "asc" | "desc")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_DIRECTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Secondary sort</p>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={filters.sort.secondary?.field ?? "none"}
                  onValueChange={(value) => handleSecondaryFieldChange(value as SummarySortField | "none")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {sortFieldOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={filters.sort.secondary?.direction ?? "desc"}
                  onValueChange={(value) => handleSecondaryDirectionChange(value as "asc" | "desc")}
                  disabled={!filters.sort.secondary}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_DIRECTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default SummaryFiltersBar;
