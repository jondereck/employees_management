"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  Briefcase,
  Building2,
  Check,
  DollarSign,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCircle,
  Users,
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

const GENDER_VALUES = ["all", "Male", "Female"] as const;
type GenderValue = (typeof GENDER_VALUES)[number];

export interface EmployeeFilterValues {
  offices: string[];
  eligibilities: string[];
  employeeTypes: string[];
  positions: string[];
  status: StatusValue;
  gender: GenderValue;
  sgMin: number | null;
  sgMax: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
}

interface EmployeeFiltersProps {
  offices: Option[];
  eligibilities: Option[];
  employeeTypes: Option[];
  positions: Option[];
  isGenioOpen?: boolean;
  onFilterChange: (filters: EmployeeFilterValues) => void;
}

const STORAGE_KEY = "employee_filters_v2";

type FilterSectionProps = {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
  icon: React.ComponentType<{ className?: string }>;
};

function FilterSection({ label, options, selected, onChange, icon: Icon }: FilterSectionProps) {
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
            onChange={(e) => setQuery(e.target.value)}
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

  // Checkbox filter states
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedEligibilities, setSelectedEligibilities] = useState<string[]>([]);
  const [selectedEmployeeTypes, setSelectedEmployeeTypes] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);

  // Toggle filter states
  const [status, setStatus] = useState<StatusValue>("all");
  const [gender, setGender] = useState<GenderValue>("all");

  // Range filter states (stored as strings for inputs)
  const [sgMin, setSgMin] = useState("");
  const [sgMax, setSgMax] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  const activeCount = useMemo(
    () =>
      selectedOffices.length +
      selectedEligibilities.length +
      selectedEmployeeTypes.length +
      selectedPositions.length +
      (status !== "all" ? 1 : 0) +
      (gender !== "all" ? 1 : 0) +
      (sgMin || sgMax ? 1 : 0) +
      (salaryMin || salaryMax ? 1 : 0),
    [selectedOffices.length, selectedEligibilities.length, selectedEmployeeTypes.length, selectedPositions.length, status, gender, sgMin, sgMax, salaryMin, salaryMax]
  );

  // Restore persisted filters on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as EmployeeFilterValues & { sgMinStr?: string; sgMaxStr?: string; salaryMinStr?: string; salaryMaxStr?: string };
      setSelectedOffices(saved.offices || []);
      setSelectedEligibilities(saved.eligibilities || []);
      setSelectedEmployeeTypes(saved.employeeTypes || []);
      setSelectedPositions(saved.positions || []);
      setStatus(saved.status || "all");
      setGender(saved.gender || "all");
      setSgMin(saved.sgMin != null ? String(saved.sgMin) : "");
      setSgMax(saved.sgMax != null ? String(saved.sgMax) : "");
      setSalaryMin(saved.salaryMin != null ? String(saved.salaryMin) : "");
      setSalaryMax(saved.salaryMax != null ? String(saved.salaryMax) : "");
      onFilterChange({
        offices: saved.offices || [],
        eligibilities: saved.eligibilities || [],
        employeeTypes: saved.employeeTypes || [],
        positions: saved.positions || [],
        status: saved.status || "all",
        gender: saved.gender || "all",
        sgMin: saved.sgMin ?? null,
        sgMax: saved.sgMax ?? null,
        salaryMin: saved.salaryMin ?? null,
        salaryMax: saved.salaryMax ?? null,
      });
    } catch {
      // ignore malformed saved filters
    }
  }, [onFilterChange]);

  const buildFilters = (): EmployeeFilterValues => ({
    offices: selectedOffices,
    eligibilities: selectedEligibilities,
    employeeTypes: selectedEmployeeTypes,
    positions: selectedPositions,
    status,
    gender,
    sgMin: sgMin ? Number(sgMin) : null,
    sgMax: sgMax ? Number(sgMax) : null,
    salaryMin: salaryMin ? Number(salaryMin) : null,
    salaryMax: salaryMax ? Number(salaryMax) : null,
  });

  const handleApply = () => {
    const next = buildFilters();
    onFilterChange(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIsOpen(false);
  };

  const clearAll = () => {
    const cleared: EmployeeFilterValues = {
      offices: [],
      eligibilities: [],
      employeeTypes: [],
      positions: [],
      status: "all",
      gender: "all",
      sgMin: null,
      sgMax: null,
      salaryMin: null,
      salaryMax: null,
    };

    setSelectedOffices([]);
    setSelectedEligibilities([]);
    setSelectedEmployeeTypes([]);
    setSelectedPositions([]);
    setStatus("all");
    setGender("all");
    setSgMin("");
    setSgMax("");
    setSalaryMin("");
    setSalaryMax("");
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

        <PopoverContent className="w-[min(92vw,380px)] rounded-2xl border-slate-200 p-0 shadow-xl" align="end">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Filters</h3>
            {activeCount > 0 ? (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
                {activeCount} active
              </span>
            ) : null}
          </div>

          {/* Scrollable filter body */}
          <div className="max-h-[70vh] overflow-y-auto px-3 py-2.5 space-y-1.5">

            {/* Status row */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
              <UserCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="w-14 shrink-0 text-[11px] font-semibold text-slate-500">Status</span>
              <div className="flex flex-1 gap-1">
                {STATUS_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={clsx(
                      "flex-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors",
                      status === value
                        ? "border-indigo-200 bg-white text-indigo-700 shadow-sm"
                        : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-600"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {/* Gender row */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="w-14 shrink-0 text-[11px] font-semibold text-slate-500">Gender</span>
              <div className="flex flex-1 gap-1">
                {GENDER_VALUES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGender(value)}
                    className={clsx(
                      "flex-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors",
                      gender === value
                        ? "border-indigo-200 bg-white text-indigo-700 shadow-sm"
                        : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-600"
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {/* SG + Salary range row */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <BarChart2 className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">SG Range</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={33}
                    placeholder="Min"
                    value={sgMin}
                    onChange={(e) => setSgMin(e.target.value)}
                    className="h-7 rounded-md border-slate-200 px-2 text-xs"
                  />
                  <span className="text-[10px] text-slate-400">–</span>
                  <Input
                    type="number"
                    min={1}
                    max={33}
                    placeholder="Max"
                    value={sgMax}
                    onChange={(e) => setSgMax(e.target.value)}
                    className="h-7 rounded-md border-slate-200 px-2 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <DollarSign className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Salary ₱</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    placeholder="Min"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    className="h-7 rounded-md border-slate-200 px-2 text-xs"
                  />
                  <span className="text-[10px] text-slate-400">–</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Max"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    className="h-7 rounded-md border-slate-200 px-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Accordion sections — collapsed by default */}
            <Accordion type="multiple" defaultValue={[]}>
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

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
            <Button variant="ghost" onClick={clearAll} className="h-8 px-2 text-xs text-slate-500 hover:text-rose-600">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button onClick={handleApply} className="h-8 rounded-lg bg-indigo-600 px-4 text-xs hover:bg-indigo-700">
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
