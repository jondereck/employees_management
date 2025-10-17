"use client";

import * as React from "react";
import { Building2, LayoutDashboard, Settings, Wrench } from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";

import Loading from "@/app/loading";
import { cn } from "@/lib/utils";
import { EmployeesMenu, EmployeesMenuLink } from "./employees-menu";

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
  const departmentId = Array.isArray(departmentParam)
    ? departmentParam[0]
    : departmentParam ?? "";

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
      icon: <LayoutDashboard className="mr-1 h-5 w-5" aria-hidden="true" />,
    },
    {
      href: `/${departmentId}/offices`,
      label: "Offices",
      active: pathname === `/${departmentId}/offices`,
      icon: <Building2 className="mr-1 h-5 w-5" aria-hidden="true" />,
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
      href: `/${departmentId}/birthdays`,
      label: "Birthdays",
      description: "See upcoming celebrants and special milestones.",
      active: pathname === `/${departmentId}/birthdays`,
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
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80">
          <Loading />
        </div>
      )}

      <nav
        className={cn(
          "flex items-center gap-4 text-sm text-muted-foreground",
          className
        )}
        {...props}
      >
        {routes.map(({ href, label, active, icon }) => (
          <button
            key={href}
            type="button"
            onClick={() => handleNavClick(href)}
            className={cn(
              "inline-flex items-center border-b-2 px-3 py-2 transition-colors duration-300",
              active
                ? "border-green-600 text-green-700 font-semibold"
                : "border-transparent hover:border-green-400 hover:text-green-600"
            )}
          >
            {icon}
            <span className="text-base">{label}</span>
          </button>
        ))}

        <EmployeesMenu
          manageRoute={manageRoute}
          quickLinks={quickLinks}
          activeRoute={activeEmployeesRoute}
          onNavigate={handleNavClick}
        />

        <button
          type="button"
          onClick={() => handleNavClick(`/${departmentId}/tools`)}
          className={cn(
            "inline-flex items-center border-b-2 px-3 py-2 text-base transition-colors duration-300",
            toolsSectionActive
              ? "border-green-600 text-green-700 font-semibold"
              : "border-transparent hover:border-green-400 hover:text-green-600"
          )}
        >
          <Wrench className="mr-2 h-5 w-5" aria-hidden="true" />
          Tools
        </button>

        <button
          type="button"
          onClick={() => handleNavClick(`/${departmentId}/settings`)}
          className={cn(
            "inline-flex items-center border-b-2 px-3 py-2 text-base transition-colors duration-300",
            pathname === `/${departmentId}/settings`
              ? "border-green-600 text-green-700 font-semibold"
              : "border-transparent hover:border-green-400 hover:text-green-600"
          )}
        >
          <Settings className="mr-2 h-5 w-5" aria-hidden="true" />
          Settings
        </button>
      </nav>
    </>
  );
}
