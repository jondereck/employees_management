"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { Offices } from "../types";

interface MainNav {
  data: Offices[];
}

const MainNav = ({
  data,
}: MainNav) => {
  const pathname = usePathname();
  const routes = data.map((route) => ({
    href: `/offices/${route.id}`,
    label: route.name,
    active: pathname  === `/offices/${route.id}`
  }))

  return (
    <nav className="mx-6 flect items-center space-x-4 lg:space-x-6">
      {routes.map((route) => (
        <Link
        key={route.href}
        href={route.href}
        className={cn("text-sm font-medium transition-colors hover:text-black", route.active ? "text-black" : "text-neutral-500")}
      >
        {route.label}
      </Link>
      ))}
    </nav>
  );
}

export default MainNav;