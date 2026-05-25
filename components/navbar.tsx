import { auth, currentUser } from "@clerk/nextjs/server";
import { Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import Notifications from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notifications";
import ApprovalsGlobalListener from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notification/approvals-global-listerner";
import type { EmployeesColumn } from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns";
import prismadb from "@/lib/prismadb";

import DepartmentSwitcher from "./department-switcher";
import { MainNav } from "./main-nav";
import MobileSidebar from "./mobile-sidebar";
import { NavbarProfile } from "./navbar-profile";

type NavbarProps = {
  departmentId: string;
};

export const Navbar = async ({ departmentId }: NavbarProps) => {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const department = await prismadb.department.findMany({
    where: {
      userId,
    },
  });

  const employees = await prismadb.employee.findMany({
    where: {
      departmentId,
    },
    include: {
      images: {
        select: { id: true, url: true, createdAt: true, updatedAt: true },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      },
      offices: true,
      employeeType: true,
      eligibility: true,
      designation: { select: { id: true, name: true } },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const user = await currentUser();
  const metadata = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const role = typeof metadata.role === "string" ? metadata.role : "HR Administrator";
  const primaryEmail =
    user?.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ||
    user?.emailAddresses[0]?.emailAddress;
  const username: string =
    user?.username ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    primaryEmail ||
    "User";
  const initials = username
    .split(/\s+/)
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const imageUrl = user?.imageUrl ?? null;

  return (
    <header className="sticky top-0 z-[120] w-full border-b border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
      <ApprovalsGlobalListener />
      <nav
        aria-label="Top navigation"
        className="grid h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pl-3 pr-2 sm:px-4 lg:grid-cols-[1fr_auto_1fr] lg:px-6 2xl:px-8"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="lg:hidden">
            <MobileSidebar />
          </div>
          <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-500 lg:flex">
            LOGO
          </div>
          <div className="hidden min-w-0 items-center xl:flex">
            <DepartmentSwitcher items={department} className="min-w-0" />
          </div>
        </div>

        <div className="hidden min-w-0 lg:flex lg:justify-center">
          <MainNav className="min-w-0" />
        </div>

        <div className="flex min-w-0 justify-self-end items-center justify-end gap-1.5 sm:gap-2">
          <Link
            href={`/${departmentId}/settings`}
            aria-label="Open settings"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Notifications data={employees as unknown as EmployeesColumn[]} />
          <NavbarProfile username={username} role={role} initials={initials} imageUrl={imageUrl} />
          <NavbarProfile username={username} role={role} initials={initials} imageUrl={imageUrl} compact />
        </div>
      </nav>
    </header>
  );
};
