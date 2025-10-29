"use client";

import React, { useMemo, useState } from "react";
import { ArrowUpDown, Check, Search as SearchIcon, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  type HeadsFilterValue,
  type SortDirection,
  type SummarySortField,
  useSummaryFilters,
} from "@/hooks/use-summary-filters";

const SORT_FIELD_LABELS: Record<SummarySortField, string> = {
  employeeName: "Name",
  employeeNo: "Employee #",
  office: "Office",
  schedule: "Schedule",
  days: "Days",
  noPunch: "No-punch",
  absences: "Absences",
  lateDays: "Late days",
  undertimeDays: "UT days",
  latePercent: "Late %",
  undertimePercent: "UT %",
  lateMinutes: "Late (min)",
  undertimeMinutes: "UT (min)",
  otTotalMinutes:"OT (min)"
};

const SORT_FIELD_OPTIONS: { value: SummarySortField; label: string }[] = (
  Object.entries(SORT_FIELD_LABELS) as Array<[SummarySortField, string]>
).map(([value, label]) => ({ value, label }));

const DIRECTION_LABELS: Record<SortDirection, string> = {
  asc: "Ascending",
  desc: "Descending",
};

export type SummaryFiltersBarProps = {
  officeOptions: { key: string; label: string; count: number }[];
  scheduleOptions: string[];
  className?: string;
};

const SummaryFiltersBar = ({ officeOptions, scheduleOptions, className }: SummaryFiltersBarProps) => {
  const {
    filters,
    setSearch,
    setHeads,
    toggleOffice,
    setOffices,
    clearOffices,
    toggleSchedule,
    clearSchedules,
    setShowUnmatched,
    setShowNoPunch,
    setMetricMode,
    setSort,
  } = useSummaryFilters();

  const [filtersOpen, setFiltersOpen] = useState(false);

  const officeSelectedSet = useMemo(() => new Set(filters.offices), [filters.offices]);
  const scheduleSelectedSet = useMemo(() => new Set(filters.schedules), [filters.schedules]);

  const sortSummary = useMemo(() => {
    const primary = `${SORT_FIELD_LABELS[filters.sortBy]} (${filters.sortDir === "asc" ? "A→Z" : "High→Low"})`;
    if (filters.secondarySortBy) {
      const secondary = `${SORT_FIELD_LABELS[filters.secondarySortBy]} (${filters.secondarySortDir === "asc" ? "A→Z" : "High→Low"})`;
      return `${primary} · ${secondary}`;
    }
    return primary;
  }, [filters.secondarySortBy, filters.secondarySortDir, filters.sortBy, filters.sortDir]);

  const handleHeadsChange = (value: string) => {
    if (value === "heads" || value === "nonHeads" || value === "all") {
      setHeads(value as HeadsFilterValue);
    } else {
      setHeads("all");
    }
  };

  const headStatusLabel = useMemo(() => {
    switch (filters.heads) {
      case "heads":
        return "Heads only";
      case "nonHeads":
        return "Exclude heads";
      default:
        return "All";
    }
  }, [filters.heads]);

  const { filtersActive, filtersActiveCount } = useMemo(() => {
    let count = 0;
    if (filters.heads !== "all") count += 1;
    if (filters.showNoPunch) count += 1;
    if (filters.showUnmatched) count += 1;
    if (filters.offices.length) count += 1;
    if (filters.schedules.length) count += 1;
    return {
      filtersActive: count > 0,
      filtersActiveCount: count,
    };
  }, [filters.heads, filters.offices.length, filters.schedules.length, filters.showNoPunch, filters.showUnmatched]);

  const handlePrimaryFieldChange = (value: SummarySortField) => {
    setSort({ sortBy: value });
  };

  const handlePrimaryDirectionChange = (value: SortDirection) => {
    setSort({ sortDir: value });
  };

  const handleSecondaryFieldChange = (value: string) => {
    if (value === "none") {
      setSort({ secondarySortBy: null });
    } else if ((SORT_FIELD_LABELS as Record<string, string>)[value]) {
      setSort({ secondarySortBy: value as SummarySortField });
    }
  };

  const handleSecondaryDirectionChange = (value: SortDirection) => {
    if (!filters.secondarySortBy) return;
    setSort({ secondarySortDir: value });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div className="flex items-center gap-2">
        <SearchIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          value={filters.search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name / employee # / token"
          className="h-9 w-64"
          aria-label="Search employees"
        />
      </div>

      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant={filtersActive ? "default" : "outline"}
            size="sm"
            className="inline-flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {filtersActive ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-background/60 px-1 text-xs font-semibold">
                {filtersActiveCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] space-y-4 p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Head status</p>
            <Select value={filters.heads} onValueChange={handleHeadsChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Head filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="heads">Heads only</SelectItem>
                <SelectItem value="nonHeads">Exclude heads</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Currently: {headStatusLabel}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="filters-show-unmatched" className="text-sm">
                Show unmatched
              </Label>
              <Switch
                id="filters-show-unmatched"
                checked={filters.showUnmatched}
                onCheckedChange={(checked) => setShowUnmatched(Boolean(checked))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="filters-show-nopunch" className="text-sm">
                Show no-punch column
              </Label>
              <Switch
                id="filters-show-nopunch"
                checked={filters.showNoPunch}
                onCheckedChange={(checked) => setShowNoPunch(Boolean(checked))}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Offices</p>
              <div className="flex items-center gap-1">
                {filters.offices.length ? (
                  <Button variant="ghost" size="sm" onClick={clearOffices}>
                    Clear
                  </Button>
                ) : null}
                {filters.offices.length < officeOptions.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOffices(officeOptions.map((o) => o.key))}
                  >
                    Select all
                  </Button>
                ) : null}
              </div>
            </div>
            <Command shouldFilter>
              <CommandInput placeholder="Search offices…" aria-label="Search offices" />
              <CommandList className="max-h-48">
                <CommandEmpty>No offices found.</CommandEmpty>
                <CommandGroup heading="Offices">
                  {officeOptions.map((option) => {
                    const checked = officeSelectedSet.has(option.key);
                    return (
                      <CommandItem
                        key={option.key}
                        onSelect={() => toggleOffice(option.key)}
                        className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
                        aria-selected={checked}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background"
                            )}
                          >
                            {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                          </span>
                          <span className="truncate">{option.label}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{option.count.toLocaleString()}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium">Metric mode</p>
            <div className="inline-flex overflow-hidden rounded-md border">
              <Button
                type="button"
                variant={filters.metricMode === "days" ? "default" : "ghost"}
                size="sm"
                className="rounded-none"
                aria-pressed={filters.metricMode === "days"}
                onClick={() => setMetricMode("days")}
              >
                Days %
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
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="inline-flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
            Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 space-y-3 p-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Primary sort</p>
            <Select value={filters.sortBy} onValueChange={(value) => handlePrimaryFieldChange(value as SummarySortField)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {SORT_FIELD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.sortDir} onValueChange={(value) => handlePrimaryDirectionChange(value as SortDirection)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">{DIRECTION_LABELS.desc}</SelectItem>
                <SelectItem value="asc">{DIRECTION_LABELS.asc}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DropdownMenuSeparator />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Secondary sort</span>
              {filters.secondarySortBy ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-mr-2 h-7 px-2"
                  onClick={() => setSort({ secondarySortBy: null })}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <Select
              value={filters.secondarySortBy ?? "none"}
              onValueChange={handleSecondaryFieldChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {SORT_FIELD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.value === filters.sortBy}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.secondarySortDir}
              onValueChange={(value) => handleSecondaryDirectionChange(value as SortDirection)}
              disabled={!filters.secondarySortBy}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{DIRECTION_LABELS.asc}</SelectItem>
                <SelectItem value="desc">{DIRECTION_LABELS.desc}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
            {sortSummary}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default SummaryFiltersBar;
