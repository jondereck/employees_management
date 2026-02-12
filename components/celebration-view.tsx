"use client";

import { useMemo, useState } from "react";
import { CelebrationGrid, type CelebrationPerson } from "./celebration-grid";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { EmployeesColumn } from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns";
import usePreviewModal from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/hooks/use-preview-modal";
import { Button } from "./ui/button";
import * as XLSX from "xlsx";
import { Calendar, Download, Search } from "lucide-react";


export type CelebrationEntry = CelebrationPerson & {
  status: "upcoming" | "completed";
  eventDate: string;
  previewData: EmployeesColumn;
};

type EmployeeType = {
  id: string;
  name: string;
  value: string;
};


type FilterValue = "upcoming" | "completed" | "all";

type CelebrationViewProps = {
  title: string;
  subtitle?: string;
  description?: string;
  emptyMessage: string;
  people: CelebrationEntry[];
  employeeTypes: EmployeeType[] | undefined
  defaultFilter?: FilterValue;
  enableDownload?: boolean;
};

const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

export function CelebrationView({
  title,
  subtitle,
  description,
  emptyMessage,
  people,
  employeeTypes,
  enableDownload = false,
  defaultFilter = "upcoming",
}: CelebrationViewProps) {
  const [filter, setFilter] = useState<FilterValue>(defaultFilter);
  const previewModal = usePreviewModal();

  const [employeeType, setEmployeeType] = useState<string>("all");
  const safeEmployeeTypes = employeeTypes ?? [];
  const showFilters = safeEmployeeTypes.length > 0;



  const [year, setYear] = useState<number>(() => {
    const years = Array.from(
      new Set(people.map(p => new Date(p.eventDate).getFullYear()))
    ).sort((a, b) => b - a);

    return years[0] ?? new Date().getFullYear();
  });

  const isCurrentYear = year === new Date().getFullYear();
  const activePeople = useMemo(() => {
    return people.filter(
      (person) => !(person as CelebrationEntry).previewData?.isArchived
    );
  }, [people]);


  const counts = useMemo(() => {
    const yearFiltered = activePeople.filter(
      (p) => new Date(p.eventDate).getFullYear() === year
    );

    return {
      upcoming: yearFiltered.filter((p) => p.status === "upcoming").length,
      completed: yearFiltered.filter((p) => p.status === "completed").length,
    };
  }, [activePeople, year]);




  const filtered = useMemo(() => {
    let base =
      filter === "all"
        ? activePeople
        : activePeople.filter((p) => p.status === filter);

    // Employee Type filter
    if (employeeType !== "all") {
      base = base.filter(
        (p) => p.previewData.employeeType.value === employeeType
      );
    }

    // ✅ YEAR FILTER — based on PRECOMPUTED milestone year
    base = base.filter(
      (p) => new Date(p.eventDate).getFullYear() === year
    );

    return base;
  }, [filter, employeeType, year, activePeople]);





  const handlePersonClick = (person: CelebrationPerson) => {
    const entry = person as CelebrationEntry;
    if (entry.previewData) {
      previewModal.onOpen(entry.previewData);
    }
  };


  const handleDownload = () => {
    if (!filtered.length) return;

    const rows = filtered.map((p) => ({
      Name: `${p.previewData.firstName} ${p.previewData.lastName}`,
      "Employee No": p.previewData.employeeNo,
      Position: p.previewData.position,
      "Employee Type": p.previewData.employeeType.name,
      "Event Date": p.eventDate,
      Status: p.status.toUpperCase(),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Anniversaries");

    const fileNameParts = [
      "anniversaries",
      filter,
      employeeType !== "all" ? employeeType : null,
    ].filter(Boolean);

    XLSX.writeFile(
      workbook,
      `${fileNameParts.join("_")}.xlsx`
    );
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    people.forEach((p) => {
      years.add(new Date(p.eventDate).getFullYear());
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [people]);


  return (
    <div className="space-y-4">
  <div className="flex w-full items-center justify-between gap-4 rounded-2xl border bg-white/80 p-2 shadow-sm backdrop-blur-md">
  {/* Left Section: Selects and Status Filter */}
  <div className="flex items-center gap-3">
    {/* Year Select */}
    <div className="flex items-center">
      <Select
        value={year.toString()}
        onValueChange={(value) => setYear(Number(value))}
      >
        <SelectTrigger className="h-10 w-[110px] border-none bg-transparent font-bold text-slate-700 focus:ring-0">
          <Calendar className="mr-2 h-4 w-4 text-blue-500" />
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
          {availableYears.map((y) => (
            <SelectItem key={y} value={y.toString()} className="font-medium">
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Vertical Divider */}
      <div className="mx-2 h-6 w-px bg-slate-200" />

      {/* Employee Type Select (Dynamic 'All Types' dropdown from your image) */}
      <Select
        value={employeeType}
        onValueChange={(value) => setEmployeeType(value)}
      >
        <SelectTrigger className="h-10 w-[140px] border-none bg-transparent font-bold text-slate-700 focus:ring-0">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
          <SelectItem value="all">All Types</SelectItem>
        {safeEmployeeTypes
  .filter((type) => type.value && type.value.trim() !== "")
  .map((type) => (
    <SelectItem key={type.id} value={type.value}>
      {type.name}
    </SelectItem>
  ))}

        </SelectContent>
      </Select>
    </div>

    {/* Status Filter (Pill/Segmented control) */}
    <ToggleGroup
      type="single"
      value={filter}
      onValueChange={(value) => value && setFilter(value as FilterValue)}
      className="inline-flex rounded-xl bg-slate-100 p-1"
    >
      {FILTER_OPTIONS
        .filter((opt) => opt.value !== "upcoming" || isCurrentYear)
        .map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="rounded-lg px-4 py-1.5 text-[11px] font-black uppercase tracking-wider transition-all data-[state=on]:bg-white data-[state=on]:text-blue-600 data-[state=on]:shadow-sm"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
    </ToggleGroup>
  </div>

  {/* Right Section: Search and Actions */}
  <div className="flex items-center gap-3 pr-2">
    {/* Search Input */}
    <div className="relative hidden lg:block">
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        type="text"
        placeholder="Search..."
        className="h-10 w-64 rounded-xl border-none bg-slate-50 pl-10 pr-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-blue-100"
      />
    </div>

    {enableDownload && (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        className="h-10 gap-2 rounded-xl font-bold text-blue-600 hover:bg-blue-50"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export Excel</span>
      </Button>
    )}
  </div>
</div>

      <CelebrationGrid
        title={title}
        subtitle={subtitle}
        description={description}
        people={filtered}
        emptyMessage={emptyMessage}
        onPersonClick={handlePersonClick}
        enableDownload={enableDownload}
        employeeTypes={safeEmployeeTypes}
      />
    </div>
  );
}

