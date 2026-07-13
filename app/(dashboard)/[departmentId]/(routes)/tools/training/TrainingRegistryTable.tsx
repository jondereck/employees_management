"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TrainingRecord } from "@/lib/training-types";
import { trainingEmployeeDisplayName } from "@/lib/training-types";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFormatter.format(d);
}

type SortKey =
  | "employee"
  | "position"
  | "office"
  | "certificateTitle"
  | "provider"
  | "dateStart"
  | "durationHours"
  | "trainingType"
  | "indicator"
  | "competencyAddressed"
  | "status";

type SortDir = "asc" | "desc";

type RegistryRow = {
  id: string;
  employee: string;
  position: string;
  office: string;
  certificateTitle: string;
  provider: string;
  dateStart: string;
  dateStartMs: number;
  durationHours: number;
  trainingType: string;
  indicator: string;
  competencyAddressed: string;
  status: string;
};

const ALL = "__all__";

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function compareRows(a: RegistryRow, b: RegistryRow, key: SortKey, dir: SortDir) {
  const mul = dir === "asc" ? 1 : -1;
  if (key === "durationHours") return (a.durationHours - b.durationHours) * mul;
  if (key === "dateStart") return (a.dateStartMs - b.dateStartMs) * mul;
  const av = String(a[key] ?? "").toLowerCase();
  const bv = String(b[key] ?? "").toLowerCase();
  return av.localeCompare(bv) * mul;
}

function SortableHead({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap font-medium hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 opacity-70" />
      </button>
    </TableHead>
  );
}

export function TrainingRegistryTable({ trainings }: { trainings: TrainingRecord[] }) {
  const [search, setSearch] = useState("");
  const [officeFilter, setOfficeFilter] = useState(ALL);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [indicatorFilter, setIndicatorFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey | null>("dateStart");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo<RegistryRow[]>(
    () =>
      trainings.map((t) => {
        const dateStartMs = new Date(t.dateStart).getTime();
        return {
          id: t.id,
          employee: trainingEmployeeDisplayName(t),
          position: t.employee?.position || t.positionRaw || "",
          office: t.employee?.offices?.name || t.officeNameRaw || "",
          certificateTitle: t.certificateTitle || "",
          provider: t.provider || "",
          dateStart: t.dateStart,
          dateStartMs: Number.isNaN(dateStartMs) ? 0 : dateStartMs,
          durationHours: t.durationHours || 0,
          trainingType: t.trainingType || "",
          indicator: t.indicator || "",
          competencyAddressed: t.competencyAddressed || "",
          status: t.status || "",
        };
      }),
    [trainings]
  );

  const officeOptions = useMemo(() => uniqueSorted(rows.map((r) => r.office)), [rows]);
  const typeOptions = useMemo(() => uniqueSorted(rows.map((r) => r.trainingType)), [rows]);
  const indicatorOptions = useMemo(() => uniqueSorted(rows.map((r) => r.indicator)), [rows]);
  const statusOptions = useMemo(() => uniqueSorted(rows.map((r) => r.status)), [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (officeFilter !== ALL && r.office !== officeFilter) return false;
      if (typeFilter !== ALL && r.trainingType !== typeFilter) return false;
      if (indicatorFilter !== ALL && r.indicator !== indicatorFilter) return false;
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.employee.toLowerCase().includes(q) ||
        r.position.toLowerCase().includes(q) ||
        r.office.toLowerCase().includes(q) ||
        r.certificateTitle.toLowerCase().includes(q) ||
        r.provider.toLowerCase().includes(q) ||
        r.trainingType.toLowerCase().includes(q) ||
        r.indicator.toLowerCase().includes(q) ||
        r.competencyAddressed.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        formatDate(r.dateStart).toLowerCase().includes(q) ||
        String(r.durationHours).includes(q)
      );
    });

    if (sortKey) {
      list = [...list].sort((a, b) => compareRows(a, b, sortKey, sortDir));
    }
    return list;
  }, [rows, search, officeFilter, typeFilter, indicatorFilter, statusFilter, sortKey, sortDir]);

  const hasFilters =
    search.trim() !== "" ||
    officeFilter !== ALL ||
    typeFilter !== ALL ||
    indicatorFilter !== ALL ||
    statusFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setOfficeFilter(ALL);
    setTypeFilter(ALL);
    setIndicatorFilter(ALL);
    setStatusFilter(ALL);
  };

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "dateStart" || key === "durationHours" ? "desc" : "asc");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee, title, office, provider…"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Office" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All offices</SelectItem>
              {officeOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {typeOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={indicatorFilter} onValueChange={setIndicatorFilter}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Indicator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All indicators</SelectItem>
              {indicatorOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {statusOptions.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filteredRows.length} of {rows.length} record{rows.length === 1 ? "" : "s"}
      </p>

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Employee" column="employee" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Position" column="position" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Office" column="office" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Training Title" column="certificateTitle" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Provider" column="provider" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Date Conducted" column="dateStart" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Hours" column="durationHours" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className="text-right" />
              <SortableHead label="Type" column="trainingType" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Indicator" column="indicator" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Competency Addressed" column="competencyAddressed" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortableHead label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                  No records match the current search/filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.employee}</TableCell>
                  <TableCell>{r.position || "—"}</TableCell>
                  <TableCell>{r.office || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate" title={r.certificateTitle}>
                    {r.certificateTitle}
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={r.provider}>
                    {r.provider}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(r.dateStart)}</TableCell>
                  <TableCell className="text-right">{r.durationHours}</TableCell>
                  <TableCell>{r.trainingType || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.indicator || "—"}</TableCell>
                  <TableCell className="max-w-xs truncate" title={r.competencyAddressed}>
                    {r.competencyAddressed || "—"}
                  </TableCell>
                  <TableCell>{r.status || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
