import type { ReactNode } from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { cn } from "@/lib/utils";

export type ToolsBreadcrumbItem = BreadcrumbItem;

interface ToolsPageShellProps {
  heading: string;
  description?: string;
  breadcrumbs: ToolsBreadcrumbItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  fullWidth?: boolean;
}

export function ToolsPageShell({
  heading,
  description,
  breadcrumbs,
  actions,
  children,
  className,
  contentClassName,
  fullWidth = false,
}: ToolsPageShellProps) {
  return (
    <div className={cn("px-4 py-6 md:px-6", className)}>
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6",
          fullWidth ? "max-w-none" : "max-w-6xl"
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Breadcrumbs items={breadcrumbs} />
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{heading}</h1>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="flex w-full items-center justify-start gap-2 md:w-auto md:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
        <div className={cn("space-y-6", contentClassName)}>{children}</div>
      </div>
    </div>
  );
}
