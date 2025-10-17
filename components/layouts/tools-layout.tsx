import * as React from "react";

import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { ToolsNavigationProvider } from "@/components/tools/navigation-provider";
import { ToolNavigationLink } from "@/components/tools/navigation-link";
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

function ToolsBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <ToolNavigationLink
                  href={item.href}
                  className="font-medium text-foreground transition-colors hover:text-primary"
                >
                  {item.label}
                </ToolNavigationLink>
              ) : (
                <span className={cn("truncate", isLast && "font-semibold text-foreground")}>
                  {item.label}
                </span>
              )}
              {!isLast && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

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
    <ToolsNavigationProvider>
      <div className="space-y-6 p-4 md:p-6">
        <div className="space-y-4">
          <ToolsBreadcrumbs items={items} />
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
    </ToolsNavigationProvider>
  );
}
