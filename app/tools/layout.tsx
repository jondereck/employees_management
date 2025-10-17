import * as React from "react";

import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { cn } from "@/lib/utils";

export type ToolsLayoutProps = {
  params: { departmentId: string };
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
};

export function ToolsLayout({
  params,
  title,
  description,
  breadcrumbs = [],
  actions,
  children,
  contentClassName,
}: ToolsLayoutProps) {
  const baseCrumb: BreadcrumbItem = breadcrumbs.length
    ? { label: "Tools", href: `/${params.departmentId}/tools` }
    : { label: "Tools" };
  const items: BreadcrumbItem[] = [baseCrumb, ...breadcrumbs];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-4">
        <Breadcrumbs items={items} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">{actions}</div>
          ) : null}
        </div>
      </div>
      <div className={cn("mx-auto w-full max-w-6xl", contentClassName)}>{children}</div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
