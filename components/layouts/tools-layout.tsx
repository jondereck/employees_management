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
  className?: string; // Prop for the outermost wrapper
  contentClassName?: string; // Prop specifically for the children container
  /** Tighter padding/title for tools that need max canvas height (e.g. org chart). */
  compact?: boolean;
};

/**
 * Enhanced Breadcrumbs with custom className support
 */
function ToolsBreadcrumbs({ 
  items, 
  className 
}: { 
  items: BreadcrumbItem[]; 
  className?: string 
}) {
  if (!items.length) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <ToolNavigationLink
                  href={item.href}
                  className="transition-colors hover:text-indigo-600"
                >
                  {item.label}
                </ToolNavigationLink>
              ) : (
                <span className={cn("truncate", isLast && "font-black")}>
                  {item.label}
                </span>
              )}
              {!isLast && <span aria-hidden="true" className="opacity-40">/</span>}
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
  className,
  contentClassName,
  compact = false,
}: ToolsLayoutProps) {
  const baseCrumb: BreadcrumbItem = breadcrumbs.length
    ? { label: "Tools", href: `/${params.departmentId}/tools` }
    : { label: "Tools" };
  const items: BreadcrumbItem[] = [baseCrumb, ...breadcrumbs];

  return (
    <ToolsNavigationProvider>
      <div 
        className={cn(
          "bg-[#f8fafc] bg-[radial-gradient(at_top_right,_#f1f5f9_0%,_#ffffff_100%)] transition-colors duration-500",
          // Viewport minus navbar (~4rem) and fixed footer clearance (~3.5rem).
          // Do not use negative margin — that pulls the canvas under the footer.
          compact ? "flex h-[calc(100dvh-4rem-3.5rem)] flex-col overflow-hidden" : "min-h-screen",
          className
        )}
      >
        <div
          className={cn(
            compact
              ? "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4"
              : "space-y-8 p-6 md:p-10 lg:p-12"
          )}
        >
          
          {/* Header Section */}
          <div className={cn("mx-auto w-full max-w-8xl", compact ? "shrink-0 space-y-2" : "space-y-6")}>
            <ToolsBreadcrumbs 
              items={items} 
              className="text-indigo-600/70 font-bold text-[10px] uppercase tracking-[0.2em]"
            />
            
            <div
              className={cn(
                "flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-slate-200",
                compact ? "gap-2 pb-3" : "gap-6 pb-8"
              )}
            >
              <div className={cn(compact ? "space-y-0.5" : "space-y-2")}>
                <h1
                  className={cn(
                    "font-black tracking-tighter text-slate-900",
                    compact ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl"
                  )}
                >
                  {title}
                </h1>
                {description ? (
                  <p
                    className={cn(
                      "max-w-2xl font-medium text-slate-500 leading-relaxed",
                      compact ? "text-sm" : "text-base"
                    )}
                  >
                    {description}
                  </p>
                ) : null}
              </div>

              {actions ? (
                <div className="flex shrink-0 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    {actions}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Content Area */}
          <div className={cn(
            "mx-auto w-full max-w-8xl animate-in fade-in slide-in-from-bottom-4 duration-700",
            compact && "flex min-h-0 flex-1 flex-col overflow-hidden",
            contentClassName
          )}>
            {children}
          </div>


        </div>
      </div>
    </ToolsNavigationProvider>
  );
}