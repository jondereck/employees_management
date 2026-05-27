import type { GenioVisualStats } from "../utils";

export function GenioStatCard({ stats }: { stats: GenioVisualStats }) {
  const maxValue = Math.max(...stats.items.map((item) => item.value), stats.total ?? 0, 1);

  return (
    <div className="mb-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
            {stats.title}
          </p>
          {typeof stats.total === "number" && (
            <p className="mt-0.5 text-2xl font-black leading-none text-slate-950">
              {stats.total.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {stats.items.length > 0 && (
        <div className="mt-3 space-y-2">
          {stats.items.map((item) => {
            const width = Math.max(8, Math.round((item.value / maxValue) * 100));
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium text-slate-700">
                    {item.label}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-slate-950">
                    {item.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${width}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
