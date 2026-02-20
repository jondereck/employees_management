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
  {loading && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-md">
      <div className="p-8 rounded-full bg-white/20 border border-white/30 shadow-2xl animate-pulse">
        <Loading />
      </div>
    </div>
  )}

<nav
  className={cn(
    "relative flex w-full items-center gap-1 overflow-x-auto whitespace-nowrap  py-3 no-scrollbar",
   
    className
  )}
  {...props}
>
  <div className="flex items-center gap-1 md:gap-2">
    {routes.map(({ href, label, active, icon }) => (
      <button
        key={href}
        type="button"
        onClick={() => handleNavClick(href)}
        className={cn(
          "relative inline-flex flex-shrink-0 items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-xl transition-all duration-500",
          active
            ? "text-green-600 dark:text-green-400 font-bold"
            : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
        )}
      >
        {/* Active Background Capsule */}
        {active && (
          <div className="absolute inset-0 bg-green-500/10 rounded-xl border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)] animate-in fade-in zoom-in duration-300" />
        )}
        
        <span className={cn("relative z-10", active && "scale-110")}>
          {icon}
        </span>
        
        {/* Hide text on very small screens to save space, or keep it—Liquid UI often prefers icons + thin text */}
        <span className="relative z-10 text-sm md:text-base">{label}</span>
      </button>
    ))}

    {/* Small divider that disappears or shrinks on mobile */}
    <div className="h-4 w-[1px] bg-white/10 mx-1 md:mx-2 flex-shrink-0" />

    <EmployeesMenu
      manageRoute={manageRoute}
      quickLinks={quickLinks}
      activeRoute={activeEmployeesRoute}
      onNavigate={handleNavClick}
      className="flex-shrink-0"
    />

    {/* Secondary Actions */}
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleNavClick(`/${departmentId}/tools`)}
        className={cn(
          "relative inline-flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300",
          toolsSectionActive ? "text-green-600 font-bold" : "text-muted-foreground hover:bg-white/10"
        )}
      >
        {toolsSectionActive && <div className="absolute inset-0 bg-green-500/5 rounded-xl border border-green-500/20" />}
        <Wrench className="h-4 w-4 md:h-5 md:w-5 relative z-10" />
        <span className="text-sm md:text-base relative z-10">Tools</span>
      </button>

      <button
        type="button"
        onClick={() => handleNavClick(`/${departmentId}/settings`)}
        className={cn(
          "relative inline-flex flex-shrink-0 items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300",
          pathname === `/${departmentId}/settings` ? "text-green-600 font-bold" : "text-muted-foreground hover:bg-white/10"
        )}
      >
        {pathname === `/${departmentId}/settings` && <div className="absolute inset-0 bg-green-500/5 rounded-xl border border-green-500/20" />}
        <Settings className="h-4 w-4 md:h-5 md:w-5 relative z-10" />
        <span className="text-sm md:text-base relative z-10">Settings</span>
      </button>
    </div>
  </div>
</nav>
</>
  );
}
