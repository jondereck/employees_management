import { UserButton, auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import Notifications from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notifications";
import ApprovalsGlobalListener from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notification/approvals-global-listerner";
import type { EmployeesColumn } from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/columns";
import prismadb from "@/lib/prismadb";

import Back from "./back";
import DepartmentSwitcher from "./department-switcher";
import { MainNav } from "./main-nav";
import MobileSidebar from "./mobile-sidebar";




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
  })

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

  

  return (
    <div className="border-b bg-background">
      <ApprovalsGlobalListener />
      <nav className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <MobileSidebar />
          <Back />
          <DepartmentSwitcher items={department} className="hidden min-w-0 lg:flex" />
        </div>
        <div className="flex min-w-0 items-center justify-start gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-visible">
          <MainNav className="hidden min-w-0 lg:flex" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Notifications data={employees as unknown as EmployeesColumn[]} />
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>
    </div>
  );
}

// flex-col lg:flex-row 
