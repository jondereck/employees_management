"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Building2,
  CalendarClock,
  Check,
  Filter,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { UseSummaryFiltersReturn } from "@/hooks/use-summary-filters";
import type { SortKey, SummaryFiltersState } from "./summaryFilters";

type OfficeOption = {
  key: string;
  label: string;
  count: number;
};

type SummaryFiltersBarProps = {
  controller: UseSummaryFiltersReturn;
  officeOptions: OfficeOption[];
  scheduleOptions: string[];
};

type MultiSelectOption = {
  value: string;
  label: string;
  description?: string;
};

const MultiSelectPopover = ({
  icon: Icon,
  label,
  placeholder,
  options,
  selectedValues,
  onToggle,
  onClear,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const triggerLabel = selectedValues.length ? `${label} (${selectedValues.length})` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder={placeholder} aria-label={placeholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => onToggle(option.value)}
                    className="flex items-center justify-between gap-2 px-2 py-2 text-sm"
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
                      <span>{option.label}</span>
                    </span>
                    {option.description ? (
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between border-t px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {selectedValues.length ? `${selectedValues.length} selected` : "Showing all"}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={!selectedValues.length}>
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const metricSortOptions = (metricMode: SummaryFiltersState["metricMode"]): Array<{ key: SortKey; label: string }> => {
  const base: Array<{ key: SortKey; label: string }> = [
    { key: "daysWithLogs", label: "Days" },
    { key: "lateDays", label: "Late (days)" },
    { key: "undertimeDays", label: "UT (days)" },
  ];
  if (metricMode === "minutes") {
    base.push({ key: "totalLateMinutes", label: "Late (min)" });
    base.push({ key: "totalUndertimeMinutes", label: "UT (min)" });
  } else {
    base.push({ key: "latePercent", label: "Late %" });
    base.push({ key: "undertimePercent", label: "UT %" });
  }
  return base;
};

const SummaryFiltersBar = ({ controller, officeOptions, scheduleOptions }: SummaryFiltersBarProps) => {
  const { filters } = controller;

  const offices = useMemo<MultiSelectOption[]>(
    () => officeOptions.map((option) => ({
      value: option.key,
      label: option.label,
      description: option.count.toLocaleString(),
    })),
    [officeOptions]
  );

  const schedules = useMemo<MultiSelectOption[]>(
    () =>
      scheduleOptions.map((option) => ({
        value: option,
        label: option,
      })),
    [scheduleOptions]
  );

  const sortOptions = useMemo(() => metricSortOptions(filters.metricMode), [filters.metricMode]);

  const secondaryValue = filters.thenBy ?? "none";

  return (
    <div className="rounded-lg border bg-card/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => controller.setSearch(event.target.value)}
            placeholder="Search name / employee # / token"
            className="pl-8"
            aria-label="Search employees"
          />
        </div>

        <ToggleGroup
          type="single"
          value={filters.heads}
          onValueChange={(value) => {
            if (value === "all" || value === "heads" || value === "nonHeads") {
              controller.setHeads(value);
            }
          }}
          size="sm"
          className="inline-flex rounded-md border bg-background p-0.5"
          aria-label="Filter by head status"
        >
          <ToggleGroupItem value="all" className="px-2 py-1 text-xs">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="heads" className="px-2 py-1 text-xs">
            Heads only
          </ToggleGroupItem>
          <ToggleGroupItem value="nonHeads" className="px-2 py-1 text-xs">
            Exclude heads
          </ToggleGroupItem>
        </ToggleGroup>

        <MultiSelectPopover
          icon={Building2}
          label="Offices"
          placeholder="Search offices…"
          options={offices}
          selectedValues={filters.offices}
          onToggle={(value) => controller.toggleOffice(value)}
          onClear={() => controller.setOffices([])}
        />

        <MultiSelectPopover
          icon={CalendarClock}
          label="Schedules"
          placeholder="Search schedules…"
          options={schedules}
          selectedValues={filters.schedules}
          onToggle={(value) => controller.toggleSchedule(value)}
          onClear={() => controller.setSchedules([])}
        />

        <div className="flex items-center gap-2">
          <Switch
            id="summary-show-unmatched"
            checked={filters.showUnmatched}
            onCheckedChange={(checked) => controller.setShowUnmatched(Boolean(checked))}
          />
          <Label htmlFor="summary-show-unmatched" className="text-sm text-muted-foreground">
            Show unmatched
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="summary-show-no-punch"
            checked={filters.showNoPunch}
            onCheckedChange={(checked) => controller.setShowNoPunch(Boolean(checked))}
          />
          <Label htmlFor="summary-show-no-punch" className="text-sm text-muted-foreground">
            Show no-punch column
          </Label>
        </div>

        <div className="inline-flex overflow-hidden rounded-md border">
          <Button
            type="button"
            variant={filters.metricMode === "days" ? "default" : "ghost"}
            size="sm"
            className="rounded-none"
            aria-pressed={filters.metricMode === "days"}
            onClick={() => controller.setMetricMode("days")}
          >
            Days
          </Button>
          <Button
            type="button"
            variant={filters.metricMode === "minutes" ? "default" : "ghost"}
            size="sm"
            className="rounded-none"
            aria-pressed={filters.metricMode === "minutes"}
            onClick={() => controller.setMetricMode("minutes")}
          >
            Minutes
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4" aria-hidden="true" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Primary sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.sortBy}
              onValueChange={(value) => controller.setPrimarySort(value as SortKey)}
            >
              {sortOptions.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
              <span>Direction</span>
              <div className="inline-flex overflow-hidden rounded-md border">
                <Button
                  type="button"
                  variant={filters.sortDir === "asc" ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-9 rounded-none text-xs"
                  onClick={() => controller.setPrimaryDir("asc")}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant={filters.sortDir === "desc" ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-9 rounded-none text-xs"
                  onClick={() => controller.setPrimaryDir("desc")}
                >
                  ↓
                </Button>
              </div>
            </div>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Secondary sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={secondaryValue}
              onValueChange={(value) => {
                if (value === "none") {
                  controller.setSecondarySort(null);
                } else {
                  controller.setSecondarySort(value as SortKey);
                }
              }}
            >
              <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
              {sortOptions.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <div className="flex items-center justify-between px-2 py-2 text-xs text-muted-foreground">
              <span>Direction</span>
              <div className="inline-flex overflow-hidden rounded-md border">
                <Button
                  type="button"
                  variant={filters.thenDir === "asc" && filters.thenBy ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-9 rounded-none text-xs"
                  onClick={() => controller.setSecondaryDir("asc")}
                  disabled={!filters.thenBy}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant={filters.thenDir === "desc" && filters.thenBy ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-9 rounded-none text-xs"
                  onClick={() => controller.setSecondaryDir("desc")}
                  disabled={!filters.thenBy}
                >
                  ↓
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
          Columns remain configurable via the Columns button.
        </div>
      </div>
    </div>
  );
};

export default SummaryFiltersBar;

