"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import type { MfRow, RetirementRow } from "@/lib/hr-planning";
import { cn } from "@/lib/utils";

import { exportHrPlanningExcel } from "./training-export";

export type HrPlanningData = {
  generatedAt: string;
  totalActiveEmployees: number;
  personnelComplement: MfRow[];
  officeDistribution: MfRow[];
  ageGroups: MfRow[];
  educationDistribution: MfRow[];
  retirementForecast: RetirementRow[];
};

function MfTable({ title, caption, firstColumn, rows }: { title: string; caption?: string; firstColumn: string; rows: MfRow[] }) {
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
                <TableRow key={row.label} className={cn(isTotal && "font-semibold bg-secondary/40")}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-center">{row.male}</TableCell>
                  <TableCell className="text-center">{row.female}</TableCell>
                  <TableCell className="text-center">{row.total}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function HrPlanningTab({ departmentId, year }: { departmentId: string; year: number }) {
  const { toast } = useToast();
  const [data, setData] = useState<HrPlanningData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/${departmentId}/analytics/hr-planning`, { signal: controller.signal });
      if (!res.ok) throw new Error("Failed to load HR planning report");
      setData(await res.json());
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast({ title: "Failed to load HR planning report", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      if (abortRef.current === controller) setIsLoading(false);
    }
  }, [departmentId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Reporting Period: CY {year} · Current workforce snapshot ({data.totalActiveEmployees} active employees) · Not affected by the year/exclude filters
        </p>
        <Button variant="outline" onClick={() => exportHrPlanningExcel(data, year)}>
          Export to Excel
        </Button>
      </div>

      <MfTable title="I-A. Personnel Complement" firstColumn="Employment Status" rows={data.personnelComplement} />
      <MfTable title="I-B. Distribution by Office" firstColumn="Office/Department" rows={data.officeDistribution} />
      <MfTable title="I-C. Distribution by Age Group" firstColumn="Age Group" rows={data.ageGroups} />
      <MfTable
        title="I-D. Distribution by Educational Attainment"
        caption="Extra rows (Elementary, College Undergraduate, Others/Unclassified) keep the total reconciled with headcount — remove them from the export if the official form needs exactly 5 rows."
        firstColumn="Educational Attainment"
        rows={data.educationDistribution}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">III. Retirement Forecast</CardTitle>
          <CardDescription>Permanent employees reaching the mandatory retirement age of 65 within each window (cumulative).</CardDescription>
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
                  <TableCell className="text-center">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
