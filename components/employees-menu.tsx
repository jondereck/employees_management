"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type EmployeesMenuLink = {
  href: string;
  label: string;
  description: string;
  active: boolean;
};

type EmployeesMenuProps = {
  manageRoute: EmployeesMenuLink;
  quickLinks: EmployeesMenuLink[];
  activeRoute?: EmployeesMenuLink;
  onNavigate: (href: string) => void;
  className?: string;
};

export function EmployeesMenu({
  manageRoute,
  quickLinks,
  activeRoute,
  onNavigate,
  className,
}: EmployeesMenuProps) {
  const [open, setOpen] = React.useState(false);

  const handleNavigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      onNavigate(href);
    },
    [onNavigate]
  );

  const firstRowLinks = quickLinks.slice(0, 2);
  const secondRowLinks = quickLinks.slice(2);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex flex-shrink-0 items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl transition-all duration-500 text-sm md:text-base"
,
            activeRoute
              ? "border-green-600 text-green-700"
              : "border-transparent text-muted-foreground hover:border-green-400 hover:text-green-600",
            className
          )}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {activeRoute ? activeRoute.label : "Employees"}
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="z-70 w-[560px] p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr_1fr]">
          <button
  type="button"
  onClick={() => handleNavigate(manageRoute.href)}
  className={cn(
    "relative z-10 flex h-full flex-col justify-between rounded-md border p-4 text-left text-sm md:text-base transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:row-span-2",
    manageRoute.active
      ? "bg-emerald-100 border-emerald-400 ring-1 ring-emerald-400 shadow-sm"
      : "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
  )}
>

            <div className="text-lg font-semibold leading-tight">{manageRoute.label}</div>
            <p className="mt-2 text-sm text-emerald-900/80">{manageRoute.description}</p>
          </button>

          {firstRowLinks.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => handleNavigate(link.href)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                link.active ? "border-primary" : "border-border"
              )}
            >
              <div className="font-medium">{link.label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
            </button>
          ))}

          {secondRowLinks.map((link) => (
            <button
              key={link.href}
              type="button"
              onClick={() => handleNavigate(link.href)}
              className={cn(
                "rounded-md border p-3 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                link.active ? "border-primary" : "border-border"
              )}
            >
              <div className="font-medium">{link.label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
