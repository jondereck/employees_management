"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
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
import ListItem from "./list-items";

import {
  Menu,
  Users,
  Building2,
  Settings,
  Eye,
  BadgeCheck,
  Briefcase,
  LayoutDashboard,
  Monitor,
  ShieldCheck,
  Building,
  UploadCloud,
} from "lucide-react";
import LoadingSkeleton from "./loading-state";
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
  const [loadingPath, setLoadingPath] = React.useState<string | null>(null);


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

  const manageEmployeesRoute = {
    href: `/${params.departmentId}/employees`,
    label: "Manage Employees",
    active: pathname === `/${params.departmentId}/employees`,
    description: "Browse and manage the list of department employees.",
    icon: <Users className="h-5 w-5 mr-1" />,
  };

  const itemroutes = [
    {
      href: `/${params.departmentId}/biometrics`,
      label: "Biometrics Uploader",
      active: pathname === `/${params.departmentId}/biometrics`,
      description: "Upload monthly biometric logs and export Late/Undertime.",
      icon: <UploadCloud className="h-5 w-5 mr-1" />,
    },
    {
      href: `/${params.departmentId}/view`,
      label: "View Employee",
      active: pathname === `/${params.departmentId}/view`,
      description: "View the list of department employees.",
      icon: <Users className="h-5 w-5 mr-1" />,
    },
    {
      href: `/${params.departmentId}/employee_type`,
      label: "Appointment",
      active: pathname === `/${params.departmentId}/employee_type`,
      description: "Manage employee appointment details.",
      icon: <Briefcase className="h-5 w-5 mr-1" />,
    },
    {
      href: `/${params.departmentId}/eligibility`,
      label: "Eligibility",
      active: pathname === `/${params.departmentId}/eligibility`,
      description: "View and update eligibility criteria for employees.",
      icon: <ShieldCheck className="h-5 w-5 mr-1" />,
    },
  ];

  const activeRoute = manageEmployeesRoute.active
    ? manageEmployeesRoute
    : itemroutes.find((route) => route.active);

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
                  "text-base font-semibold px-3 py-2 border-b-2 transition-colors duration-300",
                  activeRoute ? "border-green-600 text-green-700" : "border-transparent text-muted-foreground hover:border-green-400 hover:text-green-600"
                )}
              >
                {activeRoute ? activeRoute.label : "Employees"}
              </NavigationMenuTrigger>
              <NavigationMenuContent className="rounded-md border border-gray-200 bg-white shadow-lg p-6 w-[500px] dark:bg-gray-900 dark:border-gray-700">
                <ul className="grid grid-cols-[1fr_2fr] gap-6">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <button
                        onClick={() => handleNavClick(manageEmployeesRoute.href)}
                        className={cn(
                          "flex h-auto flex-col justify-end rounded-md bg-gradient-to-b from-green-50 to-green-100 p-6 no-underline outline-none focus:ring-2 focus:ring-green-500 text-green-700 font-semibold",
                          manageEmployeesRoute.active ? "ring-2 ring-green-500" : ""
                        )}
                      >
                        <div className="text-xl mb-1">Manage Employees</div>
                        <p className="text-sm leading-tight">Browse and manage the list of department employees.</p>
                      </button>
                    </NavigationMenuLink>
                  </li>

                  {[manageEmployeesRoute, ...itemroutes].map(({ href, label, active, description, icon }) => (
                    <ListItem
                      key={href}
                      href={href}
                      className={cn(
                        "text-sm font-medium transition-colors hover:text-green-600",
                        active ? "text-green-700 font-semibold" : "text-muted-foreground"
                      )}
                      title={label}
                      onClick={() => handleNavClick(href)}
                    >
                      <div className="flex items-center gap-2">
                        {icon}
                        <span>{label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 whitespace-normal overflow-visible break-words">
                        {description}
                      </p>
                    </ListItem>
                  ))}

                </ul>
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
