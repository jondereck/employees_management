"use client";

import * as React from "react";
import {
  Award,
  BadgeCheck,
  Briefcase,
  Cake,
  ChevronDown,
  Eye,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  type LucideIcon,
} from "lucide-react";

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

const linkIcons: Record<string, LucideIcon> = {
  "Manage Employees": Users,
  Approvals: BadgeCheck,
  Birthdays: Cake,
  "Loyalty Awards": Award,
  Retirements: UserX,
  "View Employee": Eye,
  Appointment: Briefcase,
  Eligibility: ShieldCheck,
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

  const menuLinks = [manageRoute, ...quickLinks];

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
      <DropdownMenuContent
        align="center"
        sideOffset={10}
        className="z-70 max-h-[min(72vh,560px)] w-[min(calc(100vw-1rem),680px)] overflow-y-auto p-3"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {menuLinks.map((link) => {
            const Icon = linkIcons[link.label] ?? UserCheck;
            const isManageRoute = link.href === manageRoute.href;

            return (
              <button
                key={link.href}
                type="button"
                onClick={() => handleNavigate(link.href)}
                className={cn(
                  "group flex min-h-[120px] flex-col justify-between rounded-lg border p-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                  "sm:min-h-[132px]",
                  isManageRoute && "sm:col-span-2 lg:col-span-1",
                  link.active
                    ? "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-900 hover:border-emerald-200 hover:bg-emerald-50/60"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-9 w-9 items-center justify-center rounded-md",
                    link.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="space-y-1">
                  <span className="block text-sm font-semibold leading-tight sm:text-base">{link.label}</span>
                  <span className={cn("block text-xs leading-relaxed sm:text-sm", link.active ? "text-emerald-800/80" : "text-slate-500")}>
                    {link.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
