import { UserButton, auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import Notifications from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notifications";
import ApprovalsGlobalListener from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notification/approvals-global-listerner";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import prismadb from "@/lib/prismadb";

import Back from "./back";
import DepartmentSwitcher from "./department-switcher";
import { MainNav } from "./main-nav";
import MobileSidebar from "./mobile-sidebar";




export const Navbar = async () => {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const department = await prismadb.department.findMany({
    where: {
      userId,
    },
  })

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Fetch employee data on the server
  const res = await fetch(`${apiUrl}/employees`);
  const employees: Employees[] = await res.json();

  

  return (
    <div className="border-b bg-background">
      <ApprovalsGlobalListener />
      <nav className="grid h-14 grid-cols-[auto_1fr_auto] items-center gap-2 px-4">
        <div className="flex items-center gap-2 min-w-0">
          <MobileSidebar />
          <Back />
          <DepartmentSwitcher items={department} className="hidden min-w-0 md:flex" />
        </div>
        <div className="flex min-w-0 items-center justify-start gap-6 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-visible">
          <MainNav className="hidden min-w-0 md:flex" />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Notifications data={employees} />
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>
    </div>
  );
}

// flex-col lg:flex-row 
