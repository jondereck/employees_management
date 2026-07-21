"use client";

import {
  ArrowRightLeft,
  TrendingUp,
  UserMinus,
  UserPlus,
} from "lucide-react";

import { AnimatedNumber } from "@/components/animated-number";
import { DashboardNavLink } from "@/components/dashboard/dashboard-nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  DashboardEmployeeMovementsSummary,
  DashboardMovementRow,
} from "@/lib/dashboard-employee-movements";
import { cn } from "@/lib/utils";

const glassCard =
  "border border-white/30 bg-white/40 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04]";

type MovementListProps = {
  rows: DashboardMovementRow[];
  icon: typeof UserPlus;
  emptyMessage: string;
};

function MovementList({ rows, icon: Icon, emptyMessage }: MovementListProps) {
  if (!rows.length) {
    return (
      <div className="flex min-h-[136px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-center dark:border-slate-700">
        <Icon
          className="h-8 w-8 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <ul
      role="list"
      className="max-h-[55dvh] list-none space-y-2 overflow-y-auto pr-1"
    >
      {rows.map((employee) => (
        <li key={employee.id}>
          <DashboardNavLink
            href={employee.href}
            className="flex min-h-11 w-full flex-col gap-1 rounded-xl border border-white/30 bg-white/35 px-3 py-2.5 transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07]"
          >
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {employee.name}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {employee.office}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {employee.position}
            </p>
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {employee.dateLabel}
            </p>
            {employee.details ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {employee.details}
              </p>
            ) : null}
          </DashboardNavLink>
        </li>
      ))}
    </ul>
  );
}

export function DashboardEmployeeMovementsCard({
  total,
  monthLabel,
  hired,
  promoted,
  separated,
}: DashboardEmployeeMovementsSummary) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`View ${total} employee movements for ${monthLabel}`}
          className="h-full w-full cursor-pointer rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Card
            className={cn(
              glassCard,
              "group relative h-full overflow-hidden rounded-2xl border-indigo-400/80 transition hover:bg-white/60 dark:border-indigo-500/50 dark:hover:bg-white/[0.07]",
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 to-transparent dark:from-white/[0.04]" />
            <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 p-3 pb-1.5 sm:p-4 sm:pb-2">
              <CardTitle className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:text-sm">
                Employee Movements
              </CardTitle>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 sm:h-10 sm:w-10">
                <ArrowRightLeft
                  className="h-4 w-4 sm:h-5 sm:w-5"
                  aria-hidden="true"
                />
              </span>
            </CardHeader>
            <CardContent className="relative z-10 p-3 pt-0 sm:p-4 sm:pt-0">
              <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                <AnimatedNumber value={total} />
              </div>
              <div className="mt-2 flex items-start gap-3 sm:gap-4">
                <div>
                  <AnimatedNumber
                    value={hired.count}
                    className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Hired
                  </p>
                </div>
                <div>
                  <AnimatedNumber
                    value={promoted.count}
                    className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Promoted
                  </p>
                </div>
                <div>
                  <AnimatedNumber
                    value={separated.count}
                    className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Separated
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-2xl overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle>Employee Movements</DialogTitle>
          <DialogDescription>
            {total} {total === 1 ? "movement" : "movements"} in {monthLabel}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="hired">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1">
            <TabsTrigger value="hired" className="min-h-11 gap-1.5">
              Hired
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                {hired.count}
              </span>
            </TabsTrigger>
            <TabsTrigger value="promoted" className="min-h-11 gap-1.5">
              Promoted
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                {promoted.count}
              </span>
            </TabsTrigger>
            <TabsTrigger value="separated" className="min-h-11 gap-1.5">
              Separated
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-700 dark:text-indigo-300">
                {separated.count}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hired">
            <MovementList
              rows={hired.employees}
              icon={UserPlus}
              emptyMessage="No employees hired this month"
            />
          </TabsContent>
          <TabsContent value="promoted">
            <MovementList
              rows={promoted.employees}
              icon={TrendingUp}
              emptyMessage="No promotions this month"
            />
          </TabsContent>
          <TabsContent value="separated">
            <MovementList
              rows={separated.employees}
              icon={UserMinus}
              emptyMessage="No separations this month"
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
