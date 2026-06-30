"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import type {
  DashboardGenderCountRow,
  DashboardSupervisoryByEmployeeType,
} from "@/actions/get-dashboard-summary";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardGenderCountsProps = {
  byEmployeeType: DashboardGenderCountRow[];
  byEligibility: DashboardGenderCountRow[];
  bySupervisory: DashboardGenderCountRow[];
  supervisoryByEmployeeType: DashboardSupervisoryByEmployeeType[];
  supervisoryByEligibility: DashboardSupervisoryByEmployeeType[];
};

type GroupKey = "employeeType" | "eligibility" | "supervisory";
type SupervisoryFilterDimension = "employeeType" | "eligibility";

const GROUP_LABELS: Record<GroupKey, string> = {
  employeeType: "Employee Type",
  eligibility: "Eligibility Type",
  supervisory: "Supervisory Level",
};

export function DashboardGenderCounts({
  byEmployeeType,
  byEligibility,
  bySupervisory,
  supervisoryByEmployeeType,
  supervisoryByEligibility,
}: DashboardGenderCountsProps) {
  const [groupBy, setGroupBy] = useState<GroupKey>("employeeType");
  const [supervisoryFilterDimension, setSupervisoryFilterDimension] =
    useState<SupervisoryFilterDimension>("employeeType");
  const [supervisoryTypeFilter, setSupervisoryTypeFilter] = useState("all");

  const supervisoryFilterOptions =
    supervisoryFilterDimension === "employeeType"
      ? supervisoryByEmployeeType
      : supervisoryByEligibility;

  const rows =
    groupBy === "employeeType"
      ? byEmployeeType
      : groupBy === "eligibility"
        ? byEligibility
        : groupBy === "supervisory"
          ? supervisoryFilterOptions.find((entry) => entry.id === supervisoryTypeFilter)?.rows ??
            bySupervisory
          : bySupervisory;

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          male: acc.male + row.male,
          female: acc.female + row.female,
          total: acc.total + row.total,
        }),
        { male: 0, female: 0, total: 0 },
      ),
    [rows],
  );

  return (
    <div className="rounded-2xl border border-white/20 bg-white/20 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Male / Female Counts
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pick a category to see the gender breakdown.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {groupBy === "supervisory" && (
            <>
              <Select
                value={supervisoryFilterDimension}
                onValueChange={(value) => {
                  setSupervisoryFilterDimension(value as SupervisoryFilterDimension);
                  setSupervisoryTypeFilter("all");
                }}
              >
                <SelectTrigger className="h-9 w-full bg-white/70 text-xs sm:w-[150px] dark:bg-white/10">
                  <SelectValue placeholder="Filter by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employeeType">By Employee Type</SelectItem>
                  <SelectItem value="eligibility">By Eligibility Type</SelectItem>
                </SelectContent>
              </Select>

              <Select value={supervisoryTypeFilter} onValueChange={setSupervisoryTypeFilter}>
                <SelectTrigger className="h-9 w-full bg-white/70 text-xs sm:w-[170px] dark:bg-white/10">
                  <SelectValue placeholder="Filter value" />
                </SelectTrigger>
                <SelectContent>
                  {supervisoryFilterOptions.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Select
            value={groupBy}
            onValueChange={(value) => {
              setGroupBy(value as GroupKey);
              setSupervisoryTypeFilter("all");
            }}
          >
            <SelectTrigger className="h-9 w-full bg-white/70 text-xs sm:w-[180px] dark:bg-white/10">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employeeType">Employee Type</SelectItem>
              <SelectItem value="eligibility">Eligibility Type</SelectItem>
              <SelectItem value="supervisory">Supervisory Level</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/30 dark:border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/40 text-[11px] uppercase tracking-wide text-slate-500 dark:bg-white/[0.05] dark:text-slate-400">
              <th className="px-3 py-2 text-left font-semibold">
                {GROUP_LABELS[groupBy]}
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
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-white/30 transition hover:bg-white/40 dark:border-white/10 dark:hover:bg-white/[0.05]"
                >
                  <td className="truncate px-3 py-2 text-slate-700 dark:text-slate-200">
                    {row.name}
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
              ))
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
