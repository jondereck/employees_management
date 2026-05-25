"use client";

import * as React from "react";
import { Building2, LayoutDashboard, Wrench } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";

import Loading from "@/app/loading";
import { cn } from "@/lib/utils";
import { EmployeesMenu, EmployeesMenuLink } from "./employees-menu";
import { getCurrentMonthIndexInTimeZone } from "@/lib/birthday";

type Route = {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
};

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const departmentParam = params.departmentId;
  const departmentId = Array.isArray(departmentParam) ? departmentParam[0] : departmentParam ?? "";
  const currentBirthdayMonth = getCurrentMonthIndexInTimeZone();

  const getBirthdayHref = React.useCallback(
    () => `/${departmentId}/birthdays?month=${currentBirthdayMonth}`,
    [departmentId, currentBirthdayMonth]
  );

  const handleNavClick = React.useCallback(
    (href: string) => {
      if (href !== pathname) {
        setLoading(true);
        router.push(href);
      }
    },
    [pathname, router]
  );

  React.useEffect(() => {
    setLoading(false);
  }, [pathname]);

  if (!departmentId) {
    return null;
  }

  const routes: Route[] = [
    {
      href: `/${departmentId}`,
      label: "Overview",
      active: pathname === `/${departmentId}`,
      icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
    },
    {
      href: `/${departmentId}/offices`,
      label: "Offices",
      active: pathname === `/${departmentId}/offices`,
      icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const employeesLinks: EmployeesMenuLink[] = [
    {
      href: `/${departmentId}/employees`,
      label: "Manage Employees",
      description: "Browse and manage the list of department employees.",
      active: pathname === `/${departmentId}/employees`,
    },
    {
      href: `/${departmentId}/approvals`,
      label: "Approvals",
      description: "Review pending change requests awaiting action.",
      active: pathname === `/${departmentId}/approvals`,
    },
    {
      href: getBirthdayHref(),
      label: "Birthdays",
      description: "See upcoming celebrants and special milestones.",
      active: pathname === `/${departmentId}/birthdays`,
    },
    {
      href: `/${departmentId}/anniversaries`,
      label: "Loyalty Awards",
      description: "Celebrate milestone years of service and loyalty.",
      active: pathname === `/${departmentId}/anniversaries`,
    },
    {
      href: `/${departmentId}/retirements`,
      label: "Retirements",
      description: "Track employees approaching mandatory retirement age.",
      active: pathname === `/${departmentId}/retirements`,
    },
    {
      href: `/${departmentId}/view`,
      label: "View Employee",
      description: "See the roster of department employees.",
      active: pathname === `/${departmentId}/view`,
    },
    {
      href: `/${departmentId}/employee_type`,
      label: "Appointment",
      description: "Manage employee appointment details.",
      active: pathname === `/${departmentId}/employee_type`,
    },
    {
      href: `/${departmentId}/eligibility`,
      label: "Eligibility",
      description: "View and update eligibility criteria for employees.",
      active: pathname === `/${departmentId}/eligibility`,
    },
  ];

  const manageRoute = employeesLinks[0];
  const quickLinks = employeesLinks.slice(1);
  const activeEmployeesRoute = employeesLinks.find((route) => route.active);
  const toolsSectionActive = pathname.startsWith(`/${departmentId}/tools`);

  return (
    <>
      {loading ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md">
          <div className="animate-pulse rounded-full border border-white/30 bg-white/20 p-8 shadow-2xl">
            <Loading />
          </div>
        </div>
      ) : null}

      <nav aria-label="Main navigation" className={cn("flex w-full items-center justify-center py-2", className)} {...props}>
        <div className="flex min-w-0 items-center gap-1 lg:gap-2">
          {routes.map(({ href, label, active, icon }) => (
            <button
              key={href}
              type="button"
              onClick={() => handleNavClick(href)}
              className={cn(
                "relative inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium transition-colors lg:px-3",
                active ? "text-green-700" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
                {icon}
              </span>
              <span className="hidden lg:inline">{label}</span>
              {active ? <span className="absolute inset-x-2 -bottom-[11px] h-0.5 rounded-full bg-green-600" aria-hidden="true" /> : null}
            </button>
          ))}

          <EmployeesMenu
            manageRoute={manageRoute}
            quickLinks={quickLinks}
            activeRoute={activeEmployeesRoute}
            onNavigate={handleNavClick}
            className={cn(
              "relative rounded-md px-2 py-2 text-sm font-medium transition-colors lg:px-3",
              activeEmployeesRoute ? "text-green-700" : "text-slate-600 hover:text-slate-900"
            )}
          />

          <button
            type="button"
            onClick={() => handleNavClick(`/${departmentId}/tools`)}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium transition-colors lg:px-3",
              toolsSectionActive ? "text-green-700" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Wrench className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Tools</span>
            {toolsSectionActive ? <span className="absolute inset-x-2 -bottom-[11px] h-0.5 rounded-full bg-green-600" aria-hidden="true" /> : null}
          </button>

        </div>
      </nav>
    </>
  );
}
