"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabelProps } from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOfficeWorkforceSummary } from "@/hooks/use-office-workforce";
import {
  buildOfficeWorkforceChartRows,
  filterOfficeWorkforceComparisonRows,
  getCombinedCrossOfficeCount,
  shouldRenderChartSegmentLabel,
} from "@/lib/office-workforce-view-model";
import type { WorkforceDetailsView } from "@/lib/office-workforce";

type OpenDrilldown = (
  officeId: string,
  officeName: string,
  view: WorkforceDetailsView
) => void;

type OfficeWorkforceDashboardProps = {
  departmentId: string;
  onOpenDrilldown: OpenDrilldown;
};

function ChartSegmentLabel({
  x,
  y,
  width,
  height,
  value,
  fill,
}: LabelProps) {
  const numericX = Number(x);
  const numericY = Number(y);
  const numericWidth = Number(width);
  const numericHeight = Number(height);
  const numericValue = Number(value);

  if (
    !Number.isFinite(numericX) ||
    !Number.isFinite(numericY) ||
    !Number.isFinite(numericHeight) ||
    !shouldRenderChartSegmentLabel(numericWidth, numericValue)
  ) {
    return null;
  }

  return (
    <text
      x={numericX + numericWidth / 2}
      y={numericY + numericHeight / 2}
      fill={fill}
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {numericValue}
    </text>
  );
}

function MetricCard({
  label,
  value,
  description,
  children,
}: {
  label: string;
  value: number;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export function OfficeWorkforceDashboard({
  departmentId,
  onOpenDrilldown,
}: OfficeWorkforceDashboardProps) {
  const { data, error, isLoading, mutate } =
    useOfficeWorkforceSummary(departmentId);
  const chartRows = useMemo(
    () => buildOfficeWorkforceChartRows(data?.perOffice ?? []),
    [data?.perOffice]
  );
  const comparisonRows = useMemo(
    () => filterOfficeWorkforceComparisonRows(data?.perOffice ?? []),
    [data?.perOffice]
  );
  const chartHeight = Math.max(280, chartRows.length * 52);

  if (isLoading && !data) {
    return (
      <section aria-labelledby="workforce-dashboard-title" aria-busy="true">
        <h2 id="workforce-dashboard-title" className="text-xl font-semibold">
          Office workforce
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((item) => (
            <Skeleton
              key={item}
              className="h-28 motion-reduce:animate-none"
            />
          ))}
        </div>
        <Skeleton className="mt-4 h-80 motion-reduce:animate-none" />
      </section>
    );
  }

  if (error && !data) {
    return (
      <section
        aria-labelledby="workforce-dashboard-title"
        className="rounded-lg border border-destructive/40 bg-destructive/10 p-5"
      >
        <h2 id="workforce-dashboard-title" className="text-xl font-semibold">
          Office workforce
        </h2>
        <p className="mt-2 font-medium text-destructive" role="alert">
          Workforce summary could not be loaded.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check your connection, then try again.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void mutate()}
        >
          Retry
        </Button>
      </section>
    );
  }

  if (!data || data.perOffice.length === 0) {
    return (
      <section
        aria-labelledby="workforce-dashboard-title"
        className="rounded-lg border border-dashed p-6"
      >
        <h2 id="workforce-dashboard-title" className="text-xl font-semibold">
          Office workforce
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No offices are available for workforce comparison yet.
        </p>
      </section>
    );
  }

  const overall = data.overall;
  const crossOfficeCount = getCombinedCrossOfficeCount(overall);

  return (
    <section aria-labelledby="workforce-dashboard-title" className="space-y-4">
      <div>
        <h2 id="workforce-dashboard-title" className="text-xl font-semibold">
          Office workforce
        </h2>
        <p className="text-sm text-muted-foreground">
          Active plantilla occupancy and cross-office assignments.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Plantilla"
          value={overall.activePlantillaSlots}
          description="Active plantilla slots"
        />
        <MetricCard
          label="Filled"
          value={overall.filledPlantillaSlots}
          description="Active slots with an employee"
        />
        <MetricCard
          label="Vacant"
          value={overall.vacantPlantillaSlots}
          description="Review vacant positions by office"
        >
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Choose an office
            </summary>
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
              {data.perOffice.map((office) => (
                <li key={office.officeId}>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-h-9 w-full justify-between whitespace-normal p-1 text-left text-xs"
                    onClick={() =>
                      onOpenDrilldown(
                        office.officeId,
                        office.officeName,
                        "vacant"
                      )
                    }
                    aria-label={`View ${office.vacantPlantillaSlots} vacant plantilla positions for ${office.officeName}`}
                  >
                    <span>{office.officeName}</span>
                    <span className="tabular-nums">
                      {office.vacantPlantillaSlots}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        </MetricCard>
        <MetricCard
          label="Cross-office"
          value={crossOfficeCount}
          description="Both assignment directions combined"
        >
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt>Assigned here</dt>
              <dd className="font-medium tabular-nums">
                {overall.assignedHereButPlantillaElsewhere}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Plantilla here</dt>
              <dd className="font-medium tabular-nums">
                {overall.plantillaHereButAssignedElsewhere}
              </dd>
            </div>
          </dl>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Review by office
            </summary>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
              {data.perOffice.map((office) => (
                <li key={office.officeId} className="border-t pt-1">
                  <p className="font-medium">{office.officeName}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-h-9 w-full justify-between whitespace-normal p-1 text-left text-xs"
                    onClick={() =>
                      onOpenDrilldown(
                        office.officeId,
                        office.officeName,
                        "assigned-here-plantilla-elsewhere"
                      )
                    }
                    aria-label={`View ${office.assignedHereButPlantillaElsewhere} employees assigned to ${office.officeName} with plantilla elsewhere`}
                  >
                    <span>Assigned here</span>
                    <span className="tabular-nums">
                      {office.assignedHereButPlantillaElsewhere}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-h-9 w-full justify-between whitespace-normal p-1 text-left text-xs"
                    onClick={() =>
                      onOpenDrilldown(
                        office.officeId,
                        office.officeName,
                        "plantilla-here-assigned-elsewhere"
                      )
                    }
                    aria-label={`View ${office.plantillaHereButAssignedElsewhere} employees with plantilla in ${office.officeName} assigned elsewhere`}
                  >
                    <span>Plantilla here</span>
                    <span className="tabular-nums">
                      {office.plantillaHereButAssignedElsewhere}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        </MetricCard>
      </div>

      <Card className="min-w-0">
        <details className="group">
          <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    Filled and vacant by office
                  </CardTitle>
                  <CardDescription>
                    Horizontal stacked comparison of active plantilla slots.
                    Offices without active plantilla are omitted.
                  </CardDescription>
                </div>
                <span className="shrink-0 text-sm font-medium text-primary">
                  <span className="group-open:hidden">Expand</span>
                  <span className="hidden group-open:inline">Collapse</span>
                </span>
              </div>
            </CardHeader>
          </summary>
          <CardContent className="min-w-0 overflow-hidden">
            {chartRows.length > 0 ? (
              <div
                className="min-h-[280px] w-full min-w-0"
                style={{ height: chartHeight }}
                aria-hidden="true"
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart
                        data={chartRows}
                        layout="vertical"
                        margin={{ top: 12, right: 36, left: 0, bottom: 12 }}
                      >
                        <CartesianGrid
                          stroke="hsl(var(--border))"
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fill: "hsl(var(--muted-foreground))" }}
                        />
                        <YAxis
                          type="category"
                          dataKey="officeName"
                          width={112}
                          tick={{
                            fill: "hsl(var(--foreground))",
                            fontSize: 12,
                          }}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                          contentStyle={{
                            background: "hsl(var(--popover))",
                            borderColor: "hsl(var(--border))",
                            color: "hsl(var(--popover-foreground))",
                            borderRadius: "var(--radius)",
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="filled"
                          name="Filled"
                          stackId="plantilla"
                          fill="hsl(var(--primary))"
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="filled"
                            content={
                              <ChartSegmentLabel fill="hsl(var(--primary-foreground))" />
                            }
                          />
                        </Bar>
                        <Bar
                          dataKey="vacant"
                          name="Vacant"
                          stackId="plantilla"
                          fill="hsl(var(--muted-foreground))"
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="vacant"
                            content={
                              <ChartSegmentLabel fill="hsl(var(--background))" />
                            }
                          />
                        </Bar>
                      </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No offices have active plantilla positions.
              </div>
            )}

            <details className="mt-4 rounded-md border">
              <summary className="cursor-pointer px-4 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                Accessible workforce table
              </summary>
              <div className="overflow-x-auto">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead className="text-right">Filled</TableHead>
                  <TableHead className="text-right">Vacant</TableHead>
                  <TableHead className="text-right">
                    Assigned here, plantilla elsewhere
                  </TableHead>
                  <TableHead className="text-right">
                    Plantilla here, assigned elsewhere
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonRows.map((office) => (
                  <TableRow key={office.officeId}>
                    <TableCell className="font-medium">
                      {office.officeName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {office.filledPlantillaSlots}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-10 p-2 tabular-nums"
                        onClick={() =>
                          onOpenDrilldown(
                            office.officeId,
                            office.officeName,
                            "vacant"
                          )
                        }
                        aria-label={`View ${office.vacantPlantillaSlots} vacant plantilla positions for ${office.officeName}`}
                      >
                        {office.vacantPlantillaSlots}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-10 p-2 tabular-nums"
                        onClick={() =>
                          onOpenDrilldown(
                            office.officeId,
                            office.officeName,
                            "assigned-here-plantilla-elsewhere"
                          )
                        }
                        aria-label={`View ${office.assignedHereButPlantillaElsewhere} employees assigned to ${office.officeName} with plantilla elsewhere`}
                      >
                        {office.assignedHereButPlantillaElsewhere}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-10 p-2 tabular-nums"
                        onClick={() =>
                          onOpenDrilldown(
                            office.officeId,
                            office.officeName,
                            "plantilla-here-assigned-elsewhere"
                          )
                        }
                        aria-label={`View ${office.plantillaHereButAssignedElsewhere} employees with plantilla in ${office.officeName} assigned elsewhere`}
                      >
                        {office.plantillaHereButAssignedElsewhere}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </div>
            </details>
          </CardContent>
        </details>
      </Card>
    </section>
  );
}
