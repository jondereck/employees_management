import { auth, currentUser } from "@clerk/nextjs/server";
import { Settings } from "lucide-react";
import Image from "next/image";
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
  const currentDepartment = await prismadb.department.findFirst({
    where: {
      id: departmentId,
      userId,
    },
    select: {
      logoUrl: true,
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

  return (
    <header className="sticky top-0 z-[120] w-full rounded-b-2xl border-b border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
      <ApprovalsGlobalListener />
      <nav
        aria-label="Top navigation"
        className="grid h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pl-3 pr-2 sm:px-4 lg:grid-cols-[1fr_auto_1fr] lg:px-5 2xl:px-6"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="lg:hidden">
            <MobileSidebar />
          </div>
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-slate-500 lg:flex">
            <Image
              src={currentDepartment?.logoUrl ?? "/icon-192x192.png"}
              alt="Department system logo"
              width={32}
              height={32}
              className="rounded-full object-cover"
            />
          </div>
          <div className="hidden min-w-0 items-center xl:flex">
            <DepartmentSwitcher items={department} className="min-w-0" />
          </div>
        </div>

        <div className="hidden min-w-0 lg:flex lg:justify-center">
          <MainNav className="min-w-0" />
        </div>

        <div className="flex min-w-0 justify-self-end items-center justify-end gap-1.5 sm:gap-2">
          <Notifications data={employees as unknown as EmployeesColumn[]} />
          <Link
            href={`/${departmentId}/settings`}
            aria-label="Open settings"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
          <NavbarProfile username={username} role={role} />
          <NavbarProfile username={username} role={role} compact />
        </div>
      </nav>
    </header>
  );
};
