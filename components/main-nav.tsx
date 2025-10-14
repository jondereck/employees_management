"use client";

import { cn } from "@/lib/utils";
import { useParams, usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

import { Building2, LayoutDashboard, Monitor, Settings } from "lucide-react";
import Loading from "@/app/loading";

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


  // 👇 Set loader before navigation
  const handleNavClick = (href: string) => {
    if (href !== pathname) {
      setLoading(true);
      router.push(href);
    }
  };

  // 👇 Watch for path change to turn off loader
  React.useEffect(() => {
    setLoading(false); // reset loader when pathname changes
  }, [pathname]);

  // Main nav routes with icons
  const routes: Route[] = [
    {
      href: `/${params.departmentId}`,
      label: "Overview",
      active: pathname === `/${params.departmentId}`,
      icon: <LayoutDashboard className="h-5 w-5 mr-1" />,
    },
    {
      href: `/${params.departmentId}/billboards`,
      label: "Covers",
      active: pathname === `/${params.departmentId}/billboards`,
      icon: <Monitor className="h-5 w-5 mr-1" />,
    },
    {
      href: `/${params.departmentId}/offices`,
      label: "Offices",
      active: pathname === `/${params.departmentId}/offices`,
      icon: <Building2 className="h-5 w-5 mr-1" />,
    },

  ];

  const manageRoute = {
    href: `/${params.departmentId}/employees`,
    label: "Manage Employees",
    active: pathname === `/${params.departmentId}/employees`,
    description: "Browse and manage the list of department employees.",
  };

  const quickLinks = [
    {
      href: `/${params.departmentId}/biometrics`,
      label: "Biometrics Uploader",
      active: pathname === `/${params.departmentId}/biometrics`,
      description: "Upload monthly biometric logs and export Late/Undertime.",
    },
    {
      href: `/${params.departmentId}/view`,
      label: "View Employee",
      active: pathname === `/${params.departmentId}/view`,
      description: "View the list of department employees.",
    },
    {
      href: `/${params.departmentId}/employee_type`,
      label: "Appointment",
      active: pathname === `/${params.departmentId}/employee_type`,
      description: "Manage employee appointment details.",
    },
    {
      href: `/${params.departmentId}/eligibility`,
      label: "Eligibility",
      active: pathname === `/${params.departmentId}/eligibility`,
      description: "View and update eligibility criteria for employees.",
    },
  ];

  const dropdownRoutes = [manageRoute, ...quickLinks];
  const activeRoute = dropdownRoutes.find((route) => route.active);
  const firstRowLinks = quickLinks.slice(0, 2);
  const secondRowLinks = quickLinks.slice(2);

  return (
    <>

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-black/80">
          <Loading />
        </div>
      )}
      <nav className={cn("flex items-center space-x-2", className)} {...props}>
        {/* Main routes */}
        {routes.map(({ href, label, active, icon }) => (
                <button
                key={href}
                onClick={() => handleNavClick(href)} // ✅ Use the actual route href
                className={cn(
                  "inline-flex items-center px-3 py-2 border-b-2 transition-colors duration-300",
                  active
                    ? "border-green-600 text-green-700 font-semibold"
                    : "border-transparent text-muted-foreground hover:border-green-400 hover:text-green-600"
                )}
              >
                {icon}
                <span className="text-base">{label}</span>
              </button>
        ))}

        {/* Dropdown for Employees */}
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger
                className={cn(
                  "px-3 py-2 text-base font-semibold border-b-2 transition-colors duration-300",
                  activeRoute
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-muted-foreground hover:border-green-400 hover:text-green-600"
                )}
              >
                {activeRoute ? activeRoute.label : "Employees"}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="p-0">
                <div className="w-[560px] p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_1fr_1fr]">
                    <NavigationMenuLink asChild>
                      <button
                        type="button"
                        onClick={() => handleNavClick(manageRoute.href)}
                        className={cn(
                          "flex h-full flex-col justify-between rounded-md border bg-emerald-50 p-4 text-left transition-colors duration-200 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:row-span-2",
                          manageRoute.active
                            ? "border-emerald-300 ring-1 ring-emerald-400"
                            : "border-emerald-200"
                        )}
                      >
                        <div className="text-lg font-semibold leading-tight">{manageRoute.label}</div>
                        <p className="mt-2 text-sm text-emerald-900/80">
                          {manageRoute.description}
                        </p>
                      </button>
                    </NavigationMenuLink>

                    {firstRowLinks.map(({ href, label, description, active }) => (
                      <NavigationMenuLink asChild key={href}>
                        <button
                          type="button"
                          onClick={() => handleNavClick(href)}
                          className={cn(
                            "rounded-md border p-3 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary" : "border-border"
                          )}
                        >
                          <div className="font-medium">{label}</div>
                          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        </button>
                      </NavigationMenuLink>
                    ))}

                    {secondRowLinks.map(({ href, label, description, active }) => (
                      <NavigationMenuLink asChild key={href}>
                        <button
                          type="button"
                          onClick={() => handleNavClick(href)}
                          className={cn(
                            "rounded-md border p-3 text-left transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active ? "border-primary" : "border-border"
                          )}
                        >
                          <div className="font-medium">{label}</div>
                          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                        </button>
                      </NavigationMenuLink>
                    ))}
                  </div>
                </div>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Settings link */}

        <button
          
          className={cn(
            "flex item-center text-base font-medium px-3 py-2 border-b-2 transition-colors duration-300 ",
            pathname === `/${params.departmentId}/settings`
              ? "border-green-600 text-green-700 font-semibold"
              : "border-transparent text-muted-foreground hover:border-green-400 hover:text-green-600"
          )}
          onClick={() => handleNavClick(`/${params.departmentId}/settings`)} 

        >
          <Settings className="h-5 w-5 mr-2" />
          Settings
        </button>


      </nav>
    </>

  );
}
