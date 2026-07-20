"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Users } from "lucide-react";

import type {
  DashboardGenderCountRow,
  DashboardGenderCountsNested,
  DashboardGenderGroupKey,
} from "@/actions/get-dashboard-summary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DashboardGenderCountsProps = {
  byEmployeeType: DashboardGenderCountRow[];
  byEligibility: DashboardGenderCountRow[];
  bySupervisory: DashboardGenderCountRow[];
  byOffice: DashboardGenderCountRow[];
  nested: DashboardGenderCountsNested;
};

type BreakDownKey = "none" | DashboardGenderGroupKey;

const GROUP_LABELS: Record<DashboardGenderGroupKey, string> = {
  employeeType: "Employee Type",
  eligibility: "Eligibility Type",
  supervisory: "Supervisory Level",
  office: "Office",
};

const GROUP_ORDER: DashboardGenderGroupKey[] = [
  "employeeType",
  "eligibility",
  "supervisory",
  "office",
];

function pickNestedRows(
  nested: DashboardGenderCountsNested,
  groupBy: DashboardGenderGroupKey,
  breakDownBy: DashboardGenderGroupKey,
): DashboardGenderCountRow[] {
  if (groupBy === "employeeType") {
    if (breakDownBy === "eligibility") return nested.employeeType.byEligibility;
    if (breakDownBy === "supervisory") return nested.employeeType.bySupervisory;
    return nested.employeeType.byOffice;
  }
  if (groupBy === "eligibility") {
    if (breakDownBy === "employeeType") return nested.eligibility.byEmployeeType;
    if (breakDownBy === "supervisory") return nested.eligibility.bySupervisory;
    return nested.eligibility.byOffice;
  }
  if (groupBy === "supervisory") {
    if (breakDownBy === "employeeType") return nested.supervisory.byEmployeeType;
    if (breakDownBy === "eligibility") return nested.supervisory.byEligibility;
    return nested.supervisory.byOffice;
  }
  if (breakDownBy === "employeeType") return nested.office.byEmployeeType;
  if (breakDownBy === "eligibility") return nested.office.byEligibility;
  return nested.office.bySupervisory;
}

export function DashboardGenderCounts({
  byEmployeeType,
  byEligibility,
  bySupervisory,
  byOffice,
  nested,
}: DashboardGenderCountsProps) {
  const [groupBy, setGroupBy] = useState<DashboardGenderGroupKey>("employeeType");
  const [breakDownBy, setBreakDownBy] = useState<BreakDownKey>("none");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const effectiveBreakDown: BreakDownKey =
    breakDownBy === groupBy ? "none" : breakDownBy;

  const flatRows =
    groupBy === "employeeType"
      ? byEmployeeType
      : groupBy === "eligibility"
        ? byEligibility
        : groupBy === "supervisory"
          ? bySupervisory
          : byOffice;

  const rows = useMemo((): DashboardGenderCountRow[] => {
    if (effectiveBreakDown === "none") return flatRows;
    return pickNestedRows(nested, groupBy, effectiveBreakDown);
  }, [effectiveBreakDown, flatRows, groupBy, nested]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc: { male: number; female: number; total: number }, row: DashboardGenderCountRow) => ({
          male: acc.male + row.male,
          female: acc.female + row.female,
          total: acc.total + row.total,
        }),
        { male: 0, female: 0, total: 0 },
      ),
    [rows],
  );

  const breakDownOptions = GROUP_ORDER.filter((key) => key !== groupBy);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGroupByChange = (value: DashboardGenderGroupKey) => {
    setGroupBy(value);
    setExpandedIds(new Set());
    if (breakDownBy === value) setBreakDownBy("none");
  };

  const handleBreakDownChange = (value: BreakDownKey) => {
    setBreakDownBy(value);
    setExpandedIds(new Set());
  };

  const showNested = effectiveBreakDown !== "none";

  return (
    <div className="rounded-2xl border border-white/20 bg-white/20 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Male / Female Counts
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Group rows, then optionally break each group down further.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Group by
            </span>
            <Select
              value={groupBy}
              onValueChange={(value) => handleGroupByChange(value as DashboardGenderGroupKey)}
            >
              <SelectTrigger className="h-9 w-full bg-white/70 text-xs sm:w-[170px] dark:bg-white/10">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                {GROUP_ORDER.map((key) => (
                  <SelectItem key={key} value={key}>
                    {GROUP_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Break down by
            </span>
            <Select
              value={effectiveBreakDown}
              onValueChange={(value) => handleBreakDownChange(value as BreakDownKey)}
            >
              <SelectTrigger className="h-9 w-full bg-white/70 text-xs sm:w-[170px] dark:bg-white/10">
                <SelectValue placeholder="Break down by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {breakDownOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {GROUP_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/30 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/40 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
              <th className="px-3 py-2 text-left font-semibold">
                {GROUP_LABELS[groupBy]}
                {showNested ? (
                  <span className="font-normal normal-case text-slate-400">
                    {" "}
                    → {GROUP_LABELS[effectiveBreakDown]}
                  </span>
                ) : null}
              </th>
              <th className="px-3 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                Male
              </th>
              <th className="px-3 py-2 text-right font-semibold text-pink-600 dark:text-pink-400">
                Female
              </th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => {
                const hasChildren = showNested && (row.children?.length ?? 0) > 0;
                const isExpanded = expandedIds.has(row.id);
                return (
                  <GenderCountRowGroup
                    key={row.id}
                    row={row}
                    hasChildren={hasChildren}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpanded(row.id)}
                  />
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/40 bg-white/30 dark:border-white/10 dark:bg-white/[0.04]">
                <td className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Total
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-blue-700 dark:text-blue-300">
                  {totals.male}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-pink-700 dark:text-pink-300">
                  {totals.female}
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {totals.total}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function GenderCountRowGroup({
  row,
  hasChildren,
  isExpanded,
  onToggle,
}: {
  row: DashboardGenderCountRow;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-t border-white/30 transition hover:bg-white/40 dark:border-white/10 dark:hover:bg-white/[0.05]",
          hasChildren && "cursor-pointer",
        )}
        onClick={hasChildren ? onToggle : undefined}
      >
        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
          <span className="flex min-w-0 items-center gap-1.5">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              )
            ) : (
              <span className="inline-block w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate font-medium">{row.name}</span>
          </span>
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums text-blue-600 dark:text-blue-400">
          {row.male}
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums text-pink-600 dark:text-pink-400">
          {row.female}
        </td>
        <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {row.total}
        </td>
      </tr>
      {hasChildren && isExpanded
        ? row.children?.map((child) => (
            <tr
              key={`${row.id}-${child.id}`}
              className="border-t border-white/20 bg-white/15 dark:border-white/5 dark:bg-white/[0.02]"
            >
              <td className="py-1.5 pl-9 pr-3 text-xs text-slate-600 dark:text-slate-300">
                {child.name}
              </td>
              <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                {child.male}
              </td>
              <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-pink-600 dark:text-pink-400">
                {child.female}
              </td>
              <td className="px-3 py-1.5 text-right text-xs font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {child.total}
              </td>
            </tr>
          ))
        : null}
    </>
  );
}
