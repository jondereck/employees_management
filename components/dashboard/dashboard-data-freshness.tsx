import { RefreshCw } from "lucide-react";

import { formatUpdatedAt } from "@/utils/date";

type DashboardDataFreshnessProps = {
  updatedAt: string | Date | null;
};

export function DashboardDataFreshness({ updatedAt }: DashboardDataFreshnessProps) {
  const label = updatedAt ? formatUpdatedAt(updatedAt, { tz: "Asia/Manila" }) : null;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-800 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200"
      title="Latest create, update, or archive on employees, change requests, or offices in this department. Permanent deletes are not tracked."
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        {label ? (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </>
        ) : (
          <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-400" />
        )}
      </span>
      <RefreshCw className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
      <span>
        {label ? (
          <>
            Last record change:{" "}
            <span className="font-semibold tabular-nums">{label}</span>
          </>
        ) : (
          "No record activity yet"
        )}
      </span>
    </div>
  );
}
