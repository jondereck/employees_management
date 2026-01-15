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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <Select
            value={year.toString()}
            onValueChange={(value) => setYear(Number(value))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>

            <SelectContent>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ================= STATUS FILTER ================= */}
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(value) => value && setFilter(value as FilterValue)}
            className="inline-flex w-fit rounded-lg border bg-muted/40 p-1"
          >
            {FILTER_OPTIONS
              .filter((option) => {
                if (option.value === "upcoming" && !isCurrentYear) {
                  return false;
                }
                return true;
              })
              .map((option) => {
                const count =
                  option.value === "upcoming"
                    ? counts.upcoming
                    : option.value === "completed"
                      ? counts.completed
                      : counts.upcoming + counts.completed;

                return (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="
          relative px-4 py-1.5 text-xs font-semibold uppercase tracking-wide
          text-muted-foreground transition-all
          hover:text-foreground
          data-[state=on]:bg-background
          data-[state=on]:text-foreground
          data-[state=on]:shadow-sm
        "
                  >
                    {option.label}
                    <span className="ml-1 text-[10px] opacity-70">
                      {count}
                    </span>
                  </ToggleGroupItem>
                );
              })}

          </ToggleGroup>

          {/* ================= EMPLOYEE TYPE FILTER ================= */}
          {showFilters && safeEmployeeTypes.length > 0 && (
            <div className="relative">
              <ToggleGroup
                type="single"
                value={employeeType}
                onValueChange={(value) => value && setEmployeeType(value)}
                className="
          flex gap-2 overflow-x-auto no-scrollbar
          rounded-lg border bg-muted/30 p-2
        "
              >
                {/* All Types → treated as reset */}
                <ToggleGroupItem
                  value="all"
                  className="
            rounded-full px-4 py-1.5 text-xs font-medium uppercase
            text-muted-foreground transition-all
            hover:bg-muted
            data-[state=on]:bg-foreground
            data-[state=on]:text-background
          "
                >
                  All
                </ToggleGroupItem>

                {safeEmployeeTypes.map((type) => (
                  <ToggleGroupItem
                    key={type.id}
                    value={type.value}
                    className="
              rounded-full px-4 py-1.5 text-xs font-medium uppercase
              text-muted-foreground transition-all
              hover:bg-muted
              active:scale-[0.97]
              data-[state=on]:bg-primary/15
              data-[state=on]:text-primary
              data-[state=on]:border
              data-[state=on]:border-primary/30
              data-[state=on]:shadow-sm
            "
                  >
                    {type.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}


        </div>

        {enableDownload && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            Download Excel
          </Button>
        )}

      </div>

      <CelebrationGrid
        title={title}
        subtitle={subtitle}
        description={description}
        people={filtered}
        emptyMessage={emptyMessage}
        onPersonClick={handlePersonClick}
      />
    </div>
  );
}

