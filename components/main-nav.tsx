"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import * as React from "react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu"
import ListItem from "./list-items";
import { PersonIcon } from "@radix-ui/react-icons";

type Route = {
  href: string;
  label: string;
  active: boolean;
};

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname();
  const params = useParams();

  const routes = [
    {
      href: `/${params.departmentId}`,
      label: 'Overview',
      active: pathname === `/${params.departmentId}`
    },
    {
      href: `/${params.departmentId}/billboards`,
      label: 'Billboards',
      active: pathname === `/${params.departmentId}/billboards`
    },
    {
      href: `/${params.departmentId}/offices`,
      label: 'Offices',
      active: pathname === `/${params.departmentId}/offices`
    },
    // {
    //   href: `/${params.departmentId}/employee_type`,
    //   label: 'Appointment',
    //   active: pathname === `/${params.departmentId}/employee_type`
    // },

    // {
    //   href: `/${params.departmentId}/eligibility`,
    //   label: 'Eligibilty',
    //   active: pathname === `/${params.departmentId}/eligibility`
    // },
    // {
    //   href: `/${params.departmentId}/employees`,
    //   label: 'Employees',
    //   active: pathname === `/${params.departmentId}/employees`
    // },


  ];

  const itemroutes = [
    {
      href: `/${params.departmentId}/view`,
      label: 'View Employee',
      active: pathname === `/${params.departmentId}/view`,
      description: 'View the list of department employees.',
    },

    {
      href: `/${params.departmentId}/employee_type`,
      label: 'Appointment',
      active: pathname === `/${params.departmentId}/employee_type`,
      description: 'Manage employee appointment details.',
    },

    {
      href: `/${params.departmentId}/eligibility`,
      label: 'Eligibility',
      active: pathname === `/${params.departmentId}/eligibility`,
      description: 'View and update eligibility criteria for employees.',
    },



  ];

  const activeRoute: Route | undefined = itemroutes.find(route => route.active);
  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
    >


      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn("text-sm font-medium transition-colors hover:text-primary ", route.active ? "text-black dark:text-white" : "text-muted-foreground")}
        >
          {route.label}
        </Link>
      ))}


      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger
              className={cn("", activeRoute ? "text-black dark:text-white" : "text-muted-foreground")}>
                {activeRoute ? activeRoute.label : 'Employees'}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <li className="row-span-3">
                  <NavigationMenuLink asChild>
                    <Link
                      className={cn(
                        "flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md text-muted-foreground",
                        pathname === `/${params.departmentId}/employees` ? "text-black dark:text-white" : "text-muted-foreground"
                      )}
                      href={`/${params.departmentId}/employees`}
                    >
                      <PersonIcon />
                      <div className="mb-2 mt-4 text-lg font-medium">
                        Manage Employees
                      </div>
                      <p className="text-sm leading-tight text-muted-foreground">
                        Browse and manage the list of department employees.
                      </p>
                    </Link>
                  </NavigationMenuLink>
                </li>
                {itemroutes.map((component) => (
                  <ListItem
                    key={component.href}
                    title={component.label}
                    href={component.href}
                    className={cn("text-sm font-medium transition-colors hover:text-primary ", component.active ? "text-black dark:text-white" : "text-muted-foreground")}
                  >
                    {component.description}
                  </ListItem>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

        </NavigationMenuList>
      </NavigationMenu>

      <Link
        href={`/${params.departmentId}/settings`}
        className={cn("text-sm font-medium transition-colors hover:text-primary ", pathname === `/${params.departmentId}/settings` ? "text-black dark:text-white" : "text-muted-foreground")}
      >
        Settings
      </Link>
    </nav>


  )
}
