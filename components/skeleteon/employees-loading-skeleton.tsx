// components/employees-loading-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeesLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Simulate billboard */}
      <div className="h-36 w-full rounded-xl bg-muted animate-pulse" />

      {/* Simulate heading + buttons */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Simulate search + download */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Simulate table */}
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
