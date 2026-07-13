"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  isRetiringWithin,
  RETIREMENT_WINDOWS,
  type MfRow,
  type RetirementRow,
} from "@/lib/hr-planning";
import { cn } from "@/lib/utils";

import { exportHrPlanningExcel } from "./training-export";

export type HrPlanningEmployeeRow = {
  id: string;
  name: string;
  gender: "Male" | "Female";
  position: string;
  officeName: string;
  employeeTypeName: string;
  educationRaw: string;
  educationCategory: string;
  age: number;
  ageGroup: string;
  birthday: string;
};

export type HrPlanningData = {
  year: number;
  generatedAt: string;
  asOf: string;
  totalActiveEmployees: number;
  personnelComplement: MfRow[];
  officeDistribution: MfRow[];
  ageGroups: MfRow[];
  educationDistribution: MfRow[];
  retirementForecast: RetirementRow[];
  employees: HrPlanningEmployeeRow[];
};

type GenderFilter = "Male" | "Female" | "all";

type DrilldownState = {
  title: string;
  description: string;
  employees: HrPlanningEmployeeRow[];
};

const numberFormatter = new Intl.NumberFormat("en-US");

function ClickableCount({
  value,
  onClick,
  disabled,
}: {
  value: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (disabled || value <= 0) {
    return <span className="tabular-nums">{numberFormatter.format(value)}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded px-1.5 py-0.5 font-semibold tabular-nums text-indigo-600 underline-offset-4 transition-colors hover:bg-indigo-50 hover:underline"
      title="View employees behind this number"
    >
      {numberFormatter.format(value)}
    </button>
  );
}

function MfTable({
  title,
  caption,
  firstColumn,
  rows,
  onCountClick,
}: {
  title: string;
  caption?: string;
  firstColumn: string;
  rows: MfRow[];
  onCountClick: (label: string, gender: GenderFilter) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {caption ? <CardDescription>{caption}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{firstColumn}</TableHead>
              <TableHead className="w-24 text-center">Male</TableHead>
              <TableHead className="w-24 text-center">Female</TableHead>
              <TableHead className="w-24 text-center">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const isTotal = row.label === "Total";
              return (
                <TableRow key={row.label} className={cn(isTotal && "bg-secondary/40 font-semibold")}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-center">
                    <ClickableCount value={row.male} onClick={() => onCountClick(row.label, "Male")} />
                  </TableCell>
                  <TableCell className="text-center">
                    <ClickableCount value={row.female} onClick={() => onCountClick(row.label, "Female")} />
                  </TableCell>
                  <TableCell className="text-center">
                    <ClickableCount value={row.total} onClick={() => onCountClick(row.label, "all")} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PlaceholderSection({ title, reason }: { title: string; reason: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{reason}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          Not auto-filled yet — no matching structured data in the database for this section.
        </p>
      </CardContent>
    </Card>
  );
}

export default function HrPlanningTab({ departmentId, year }: { departmentId: string; year: number }) {
  const { toast } = useToast();
  const [data, setData] = useState<HrPlanningData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      const res = await fetch(`/api/${departmentId}/analytics/hr-planning?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to load HR planning report");
      setData(await res.json());
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast({ title: "Failed to load HR planning report", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, [departmentId, year, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const asOf = useMemo(() => (data ? new Date(data.asOf) : null), [data]);

  const openFiltered = useCallback(
    (
      title: string,
      description: string,
      predicate: (e: HrPlanningEmployeeRow) => boolean,
      gender: GenderFilter
    ) => {
      if (!data) return;
      const employees = data.employees
        .filter(predicate)
        .filter((e) => (gender === "all" ? true : e.gender === gender))
        .sort((a, b) => a.name.localeCompare(b.name));
      const genderLabel = gender === "all" ? "All genders" : gender;
      setDrilldown({
        title,
        description: `${description} · ${genderLabel} · ${employees.length} employee${employees.length === 1 ? "" : "s"}`,
        employees,
      });
    },
    [data]
  );

  const openPersonnel = useCallback(
    (label: string, gender: GenderFilter) => {
      openFiltered(
        `Personnel Complement — ${label}`,
        label === "Total" ? "All employment statuses" : `Employment status: ${label}`,
        (e) => (label === "Total" ? true : (e.employeeTypeName.trim() || "Unassigned") === label),
        gender
      );
    },
    [openFiltered]
  );

  const openOffice = useCallback(
    (label: string, gender: GenderFilter) => {
      openFiltered(
        `Distribution by Office — ${label}`,
        label === "Total" ? "All offices" : `Office: ${label}`,
        (e) => (label === "Total" ? true : (e.officeName.trim() || "Unassigned") === label),
        gender
      );
    },
    [openFiltered]
  );

  const openAge = useCallback(
    (label: string, gender: GenderFilter) => {
      openFiltered(
        `Distribution by Age Group — ${label}`,
        label === "Total" ? "All age groups" : `Age group: ${label}`,
        (e) => (label === "Total" ? true : e.ageGroup === label),
        gender
      );
    },
    [openFiltered]
  );

  const openEducation = useCallback(
    (label: string, gender: GenderFilter) => {
      openFiltered(
        `Educational Attainment — ${label}`,
        label === "Total" ? "All education categories" : `Education: ${label}`,
        (e) => (label === "Total" ? true : e.educationCategory === label),
        gender
      );
    },
    [openFiltered]
  );

  const openRetirement = useCallback(
    (label: string) => {
      if (!data || !asOf) return;
      const window = RETIREMENT_WINDOWS.find((w) => w.label === label);
      if (!window) return;
      const employees = data.employees
        .filter((e) => e.employeeTypeName.trim().toLowerCase() === "permanent")
        .filter((e) => isRetiringWithin(new Date(e.birthday), asOf, window.years))
        .sort((a, b) => a.name.localeCompare(b.name));
      setDrilldown({
        title: `Retirement Forecast — ${label}`,
        description: `Permanent employees reaching age 65 within ${label.toLowerCase()} · ${employees.length} employee${employees.length === 1 ? "" : "s"}`,
        employees,
      });
    },
    [data, asOf]
  );

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Annex 3-E: Annual Human Resource Planning Report</h2>
          <p className="text-sm text-muted-foreground">
            Reporting Period: CY {year} · Eligible workforce snapshot ({data.totalActiveEmployees} not archived / not terminated) · Click any
            count to view employees
          </p>
        </div>
        <Button variant="outline" onClick={() => exportHrPlanningExcel(data, year)}>
          Export to Excel
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">I. Workforce Profile</h3>
        <MfTable
          title="A. Personnel Complement"
          firstColumn="Employment Status"
          rows={data.personnelComplement}
          onCountClick={openPersonnel}
        />
        <MfTable
          title="B. Distribution by Office"
          firstColumn="Office/Department"
          rows={data.officeDistribution}
          onCountClick={openOffice}
        />
        <MfTable title="C. Distribution by Age Group" firstColumn="Age Group" rows={data.ageGroups} onCountClick={openAge} />
        <MfTable
          title="D. Distribution by Educational Attainment"
          caption="Free-text education values are classified into annex categories. Extra rows (Elementary, College Undergraduate, Others/Unclassified) keep totals reconciled with headcount."
          firstColumn="Educational Attainment"
          rows={data.educationDistribution}
          onCountClick={openEducation}
        />
      </div>

      <PlaceholderSection
        title="II. Workforce Gap Analysis"
        reason="Needs plantilla required-positions and vacancy tracking (Existing vs Required, Critical Vacancies). Not stored as structured fields yet."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">III. Retirement Forecast</CardTitle>
          <CardDescription>
            Permanent employees reaching mandatory retirement age 65 within each window (cumulative), as of end of CY {year}. Click a count to
            view names.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number of Employees Retiring Within</TableHead>
                <TableHead className="w-32 text-center">Total Employees</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.retirementForecast.map((row) => (
                <TableRow key={row.label}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-center">
                    <ClickableCount value={row.total} onClick={() => openRetirement(row.label)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <PlaceholderSection
        title="IV. Succession Planning Status"
        reason="Needs critical position / incumbent / successor / readiness records. Not in the employee schema yet."
      />
      <PlaceholderSection
        title="V. Talent Development Priorities"
        reason="Needs competency-gap intervention plans with target employees and completion dates."
      />
      <PlaceholderSection title="VI. Recommendations" reason="Free-text recommendations — fill on the exported Excel or printed form." />

      <Dialog open={drilldown !== null} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{drilldown?.title}</DialogTitle>
            <DialogDescription>{drilldown?.description}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead className="text-center">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drilldown?.employees ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No employees in this group.
                    </TableCell>
                  </TableRow>
                ) : (
                  drilldown!.employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{e.name}</TableCell>
                      <TableCell>{e.gender}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.employeeTypeName}</TableCell>
                      <TableCell>{e.position || "—"}</TableCell>
                      <TableCell>{e.officeName}</TableCell>
                      <TableCell className="text-center">{e.age}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
