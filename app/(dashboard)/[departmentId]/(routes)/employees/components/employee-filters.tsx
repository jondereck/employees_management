"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  Check,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCircle,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import clsx from "clsx";

interface Option {
  id: string;
  name: string;
}

const STATUS_VALUES = ["all", "Active", "Inactive"] as const;
type StatusValue = (typeof STATUS_VALUES)[number];

interface EmployeeFiltersProps {
  offices: Option[];
  eligibilities: Option[];
  employeeTypes: Option[];
  positions: Option[];
  isGenioOpen?: boolean;
  onFilterChange: (filters: {
    offices: string[];
    eligibilities: string[];
    employeeTypes: string[];
    positions: string[];
    status: StatusValue;
  }) => void;
}

const STORAGE_KEY = "employee_filters_v1";

type FilterSectionProps = {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  icon: React.ComponentType<{ className?: string }>;
};

function FilterSection({
  label,
  options,
  selected,
  onChange,
  icon: Icon,
}: FilterSectionProps) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.name.toLowerCase().includes(normalized));
  }, [options, query]);

  return (
    <AccordionItem value={label} className="border-b border-slate-100">
      <AccordionTrigger className="py-3 text-sm font-semibold text-slate-800 hover:no-underline">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span>{label}</span>
          {selected.length > 0 ? (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
              {selected.length}
            </span>
          ) : null}
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className="h-9 rounded-lg border-slate-200 pl-9 text-sm"
          />
        </div>

        <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={clsx(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                    checked
                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className="truncate">{option.name}</span>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(state) => {
                      const next = new Set(selected);
                      if (state) next.add(option.id);
                      else next.delete(option.id);
                      onChange(Array.from(next));
                    }}
                  />
                </label>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
              No matching options.
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function EmployeeFilters({
  offices,
  eligibilities,
  employeeTypes,
  positions,
  onFilterChange,
}: EmployeeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedEligibilities, setSelectedEligibilities] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusValue>("all");

  const activeCount = useMemo(
    () =>
      selectedOffices.length +
      selectedEligibilities.length +
      selectedEmployeeTypes.length +
      selectedPositions.length +
      (status !== "all" ? 1 : 0),
    [selectedEligibilities.length, selectedEmployeeTypes.length, selectedOffices.length, selectedPositions.length, status]
  );

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      setSelectedOffices(saved.offices || []);
      setSelectedEligibilities(saved.eligibilities || []);
      setSelectedEmployeeTypes(saved.employeeTypes || []);
      setSelectedPositions(saved.positions || []);
      setStatus(saved.status || "all");
      onFilterChange(saved);
    } catch {
      // ignore malformed saved filters
    }
  }, [onFilterChange]);

  const handleApply = () => {
    const next = {
      offices: selectedOffices,
      eligibilities: selectedEligibilities,
      employeeTypes: selectedEmployeeTypes,
      positions: selectedPositions,
      status,
    };

    onFilterChange(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIsOpen(false);
  };

  const clearAll = () => {
    const cleared = {
      offices: [],
      eligibilities: [],
      employeeTypes: [],
      positions: [],
      status: "all" as StatusValue,
    };

    setSelectedOffices([]);
    setSelectedEligibilities([]);
    setSelectedEmployeeTypes([]);
    setSelectedPositions([]);
    setStatus("all");
    onFilterChange(cleared);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleared));
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={clsx(
              "relative h-10 gap-2 rounded-xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50",
              activeCount > 0 && "border-indigo-200 bg-indigo-50/60 text-indigo-700"
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
            {activeCount > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[min(92vw,420px)] rounded-2xl border-slate-200 p-0 shadow-xl" align="end">
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Employee Filters</h3>
                <p className="text-xs text-slate-500">Keep the list focused without leaving the page.</p>
              </div>
              {activeCount > 0 ? (
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                  {activeCount} active
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[72vh] overflow-y-auto px-4 py-4">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <UserCircle className="h-4 w-4 text-slate-400" />
                Employment Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={clsx(
                      "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                      status === value
                        ? "border-indigo-200 bg-white text-indigo-700 shadow-sm"
                        : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <Accordion type="multiple" defaultValue={["Offices", "Appointment"]} className="mt-4">
              <FilterSection
                label="Offices"
                options={offices}
                selected={selectedOffices}
                onChange={setSelectedOffices}
                icon={Building2}
              />
              <FilterSection
                label="Appointment"
                options={employeeTypes}
                selected={selectedEmployeeTypes}
                onChange={setSelectedEmployeeTypes}
                icon={Briefcase}
              />
              <FilterSection
                label="Eligibility"
                options={eligibilities}
                selected={selectedEligibilities}
                onChange={setSelectedEligibilities}
                icon={ShieldCheck}
              />
              <FilterSection
                label="Position Title"
                options={positions}
                selected={selectedPositions}
                onChange={setSelectedPositions}
                icon={Briefcase}
              />
            </Accordion>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
            <Button variant="ghost" onClick={clearAll} className="h-9 px-3 text-slate-500 hover:text-rose-600">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button onClick={handleApply} className="h-9 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700">
              <Check className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
