"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  List,
  Table2,
  type LucideIcon,
} from "lucide-react";
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
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useOfficeWorkforceSummary } from "@/hooks/use-office-workforce";
import type { WorkforceDetailsView } from "@/lib/office-workforce";
import type { VacantPositionExportItem } from "@/lib/office-workforce-export";
import { summarizeAuthorizedPositions } from "@/lib/office-workforce-position-summary";
import {
  buildOfficeWorkforceChartRows,
  filterOfficeWorkforceComparisonRows,
  filterOfficeWorkforceRows,
  getCombinedCrossOfficeCount,
  shouldRenderChartSegmentLabel,
  type OfficeWorkforceFilter,
} from "@/lib/office-workforce-view-model";

type OpenDrilldown = (
  officeId: string,
  officeName: string,
  view: WorkforceDetailsView
) => void;

type DashboardView = "chart" | "table" | "positions";

type OfficeWorkforceDashboardProps = {
  departmentId: string;
  onOpenDrilldown: OpenDrilldown;
};

function formatPercent(value: number) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}%`;
}

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
      className="text-xs font-semibold"
    >
      {numericValue}
    </text>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  iconClassName,
  iconBackgroundClassName,
  labelClassName,
  children,
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
  labelClassName: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="flex min-h-[132px] gap-4 p-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBackgroundClassName}`}
          aria-hidden="true"
        >
          <Icon className={`h-5 w-5 ${iconClassName}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${labelClassName}`}>{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function DrilldownCount({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="link"
      className="h-auto min-h-11 gap-1 p-2 font-medium tabular-nums"
      onClick={onClick}
      aria-label={label}
    >
      {value}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );
}

export function OfficeWorkforceDashboard({
  departmentId,
  onOpenDrilldown,
}: OfficeWorkforceDashboardProps) {
  const { data, error, isLoading, mutate } =
    useOfficeWorkforceSummary(departmentId);
  const [view, setView] = useState<DashboardView>("chart");
  const [filter, setFilter] = useState<OfficeWorkforceFilter>("all");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [exporting, setExporting] = useState(false);

  const comparisonRows = useMemo(
    () => filterOfficeWorkforceComparisonRows(data?.perOffice ?? []),
    [data?.perOffice]
  );
  const visibleRows = useMemo(
    () => filterOfficeWorkforceRows(comparisonRows, filter),
    [comparisonRows, filter]
  );
  const chartRows = useMemo(
    () => buildOfficeWorkforceChartRows(visibleRows),
    [visibleRows]
  );
  const visiblePositionRows = useMemo(() => {
    const officeIds = new Set(visibleRows.map((row) => row.officeId));
    return (data?.positionSummary ?? []).filter((row) =>
      officeIds.has(row.officeId)
    );
  }, [data?.positionSummary, visibleRows]);
  const visiblePositionTotals = useMemo(
    () => summarizeAuthorizedPositions(visiblePositionRows),
    [visiblePositionRows]
  );
  const chartHeight = Math.max(320, chartRows.length * 50);

  if (isLoading && !data) {
    return (
      <section aria-labelledby="workforce-dashboard-title" aria-busy="true">
        <h2 id="workforce-dashboard-title" className="text-xl font-semibold">
          Office workforce
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton
              key={item}
              className="h-32 motion-reduce:animate-none"
            />
          ))}
        </div>
        <Skeleton className="mt-4 h-96 motion-reduce:animate-none" />
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
  const occupancyRate =
    overall.activePlantillaSlots === 0
      ? 0
      : (overall.filledPlantillaSlots * 100) /
        overall.activePlantillaSlots;

  const handleExport = async () => {
    setExporting(true);
    try {
      const [exportModule, response] = await Promise.all([
        import("@/utils/export-office-workforce"),
        fetch(`/api/${departmentId}/offices/workforce-export`, {
          cache: "no-store",
        }),
      ]);
      if (!response.ok) {
        throw new Error("Vacant position export data could not be loaded.");
      }
      const exportData = (await response.json()) as {
        vacantPositions: VacantPositionExportItem[];
      };
      const { exportOfficeWorkforceExcel } = exportModule;
      exportOfficeWorkforceExcel({
        rows: comparisonRows,
        overall,
        vacantPositions: exportData.vacantPositions,
        authorizedPositions: data.positionSummary ?? [],
      });
      toast.success("Office workforce Excel downloaded.");
    } catch (exportError) {
      console.error("[OFFICE_WORKFORCE_EXPORT]", exportError);
      toast.error("Could not create the workforce Excel file.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <section aria-label="Office workforce" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active Plantilla"
          value={overall.activePlantillaSlots}
          description="Active plantilla slots"
          icon={Briefcase}
          iconClassName="text-blue-600"
          iconBackgroundClassName="bg-blue-50 dark:bg-blue-950/40"
          labelClassName="text-blue-700 dark:text-blue-400"
        />
        <MetricCard
          label="Filled"
          value={overall.filledPlantillaSlots}
          description={`${formatPercent(occupancyRate)} occupancy`}
          icon={CheckCircle2}
          iconClassName="text-emerald-600"
          iconBackgroundClassName="bg-emerald-50 dark:bg-emerald-950/40"
          labelClassName="text-emerald-700 dark:text-emerald-400"
        />
        <MetricCard
          label="Vacant"
          value={overall.vacantPlantillaSlots}
          description={`${formatPercent(overall.vacancyRate)} vacancy`}
          icon={AlertCircle}
          iconClassName="text-amber-600"
          iconBackgroundClassName="bg-amber-50 dark:bg-amber-950/40"
          labelClassName="text-amber-700 dark:text-amber-400"
        />
        <MetricCard
          label="Cross-office"
          value={crossOfficeCount}
          description="Both assignment directions combined"
          icon={ArrowLeftRight}
          iconClassName="text-violet-600"
          iconBackgroundClassName="bg-violet-50 dark:bg-violet-950/40"
          labelClassName="text-violet-700 dark:text-violet-400"
        >
          <dl className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Assigned here</dt>
              <dd className="font-semibold tabular-nums">
                {overall.assignedHereButPlantillaElsewhere}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Plantilla here</dt>
              <dd className="font-semibold tabular-nums">
                {overall.plantillaHereButAssignedElsewhere}
              </dd>
            </div>
          </dl>
        </MetricCard>
      </div>

      <Tabs
        value={view}
        onValueChange={(value) => setView(value as DashboardView)}
      >
        <Card className="min-w-0 shadow-none">
          <CardHeader className="gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">
                Workforce details by office
              </CardTitle>
              <CardDescription>
                Exact plantilla occupancy and cross-office assignment counts.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="gap-2"
                onClick={() => setIsCollapsed((collapsed) => !collapsed)}
                aria-expanded={!isCollapsed}
                aria-controls="workforce-details-content"
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                )}
                {isCollapsed ? "Expand" : "Collapse"}
              </Button>
              <TabsList aria-label="Workforce visualization">
                <TabsTrigger value="chart" className="gap-2">
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  Chart
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <Table2 className="h-4 w-4" aria-hidden="true" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="positions" className="gap-2">
                  <List className="h-4 w-4" aria-hidden="true" />
                  Position Summary
                </TabsTrigger>
              </TabsList>
              <Select
                value={filter}
                onValueChange={(value) =>
                  setFilter(value as OfficeWorkforceFilter)
                }
              >
                <SelectTrigger
                  className="w-[180px]"
                  aria-label="Filter workforce offices"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All offices</SelectItem>
                  <SelectItem value="vacant">With vacancies</SelectItem>
                  <SelectItem value="cross-office">
                    With cross-office assignments
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => void handleExport()}
                disabled={exporting || comparisonRows.length === 0}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {exporting ? "Preparing…" : "Download Excel"}
              </Button>
            </div>
          </CardHeader>

          {!isCollapsed ? (
          <CardContent
            id="workforce-details-content"
            className="min-w-0 p-4"
          >
            <TabsContent value="chart" className="mt-0">
              {chartRows.length > 0 ? (
                <>
                  <p className="sr-only">
                    Horizontal stacked chart of filled and vacant active
                    plantilla slots. Use the Table view for exact accessible
                    values.
                  </p>
                  <div
                    className="min-h-[320px] w-full min-w-0"
                    style={{ height: chartHeight }}
                    aria-hidden="true"
                  >
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                      <BarChart
                        data={chartRows}
                        layout="vertical"
                        barCategoryGap={14}
                        margin={{ top: 12, right: 48, left: 12, bottom: 12 }}
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
                          width={220}
                          tick={{
                            fill: "hsl(var(--foreground))",
                            fontSize: 11,
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
                        <Legend verticalAlign="top" align="left" />
                        <Bar
                          dataKey="filled"
                          name="Filled"
                          stackId="plantilla"
                          fill="hsl(222 47% 16%)"
                          radius={[4, 0, 0, 4]}
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
                          fill="hsl(38 92% 50%)"
                          radius={[0, 4, 4, 0]}
                          isAnimationActive={false}
                        >
                          <LabelList
                            dataKey="vacant"
                            content={<ChartSegmentLabel fill="hsl(222 47% 11%)" />}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No offices match this workforce filter.
                </div>
              )}
            </TabsContent>

            <TabsContent value="table" className="mt-0">
              {visibleRows.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[220px]">Office</TableHead>
                        <TableHead className="text-right">
                          Active plantilla
                        </TableHead>
                        <TableHead className="text-right">Filled</TableHead>
                        <TableHead className="text-right">Vacant</TableHead>
                        <TableHead className="min-w-[170px] text-right">
                          Assigned here / plantilla elsewhere
                        </TableHead>
                        <TableHead className="min-w-[170px] text-right">
                          Plantilla here / assigned elsewhere
                        </TableHead>
                        <TableHead className="text-right">
                          Vacancy rate
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleRows.map((office) => (
                        <TableRow key={office.officeId}>
                          <TableCell className="font-medium">
                            {office.officeName}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {office.activePlantillaSlots}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {office.filledPlantillaSlots}
                          </TableCell>
                          <TableCell className="text-right">
                            <DrilldownCount
                              value={office.vacantPlantillaSlots}
                              label={`View ${office.vacantPlantillaSlots} vacant plantilla positions for ${office.officeName}`}
                              onClick={() =>
                                onOpenDrilldown(
                                  office.officeId,
                                  office.officeName,
                                  "vacant"
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <DrilldownCount
                              value={
                                office.assignedHereButPlantillaElsewhere
                              }
                              label={`View ${office.assignedHereButPlantillaElsewhere} employees assigned to ${office.officeName} with plantilla elsewhere`}
                              onClick={() =>
                                onOpenDrilldown(
                                  office.officeId,
                                  office.officeName,
                                  "assigned-here-plantilla-elsewhere"
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <DrilldownCount
                              value={
                                office.plantillaHereButAssignedElsewhere
                              }
                              label={`View ${office.plantillaHereButAssignedElsewhere} employees with plantilla in ${office.officeName} assigned elsewhere`}
                              onClick={() =>
                                onOpenDrilldown(
                                  office.officeId,
                                  office.officeName,
                                  "plantilla-here-assigned-elsewhere"
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(office.vacancyRate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                    {visibleRows.length.toLocaleString()}{" "}
                    {visibleRows.length === 1 ? "office" : "offices"}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No offices match this workforce filter.
                </div>
              )}
            </TabsContent>

            <TabsContent value="positions" className="mt-0">
              {visiblePositionRows.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="min-w-[220px]">Office</TableHead>
                        <TableHead className="min-w-[260px]">
                          Authorized Position
                        </TableHead>
                        <TableHead className="min-w-[160px]">
                          Employment Status
                        </TableHead>
                        <TableHead className="text-right">
                          Total Authorized
                        </TableHead>
                        <TableHead className="text-right">Filled</TableHead>
                        <TableHead className="text-right">Vacant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePositionRows.map((row) => (
                        <TableRow
                          key={`${row.officeId}-${row.positionTitle}-${row.employeeTypeName}`}
                          className={
                            row.vacant > 0
                              ? "bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40"
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            {row.officeName}
                          </TableCell>
                          <TableCell>{row.positionTitle}</TableCell>
                          <TableCell>{row.employeeTypeName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.totalAuthorized}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.filled}
                          </TableCell>
                          <TableCell
                            className={
                              row.vacant > 0
                                ? "text-right font-bold text-emerald-700 tabular-nums dark:text-emerald-400"
                                : "text-right font-medium tabular-nums"
                            }
                          >
                            {row.vacant}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/70 font-bold hover:bg-muted">
                        <TableCell colSpan={3}>TOTAL</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {visiblePositionTotals.totalAuthorized}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {visiblePositionTotals.filled}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {visiblePositionTotals.vacant}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="border-t px-4 py-3 text-sm text-muted-foreground">
                    {visiblePositionRows.length.toLocaleString()} grouped{" "}
                    {visiblePositionRows.length === 1 ? "position" : "positions"}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No authorized positions match this workforce filter.
                </div>
              )}
            </TabsContent>
          </CardContent>
          ) : null}
        </Card>
      </Tabs>
    </section>
  );
}
