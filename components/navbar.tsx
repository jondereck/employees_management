import { UserButton, auth } from "@clerk/nextjs";
import DepartmentSwitcher from "./department-switcher";
import { redirect } from "next/navigation";
import prismadb from "@/lib/prismadb";
import Back from "./back";
import Notifications from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notifications";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import MobileSidebar from "./mobile-sidebar";
import { MainNav } from "./main-nav";




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
    <div className="border-b ">
      <div className="flex items-center lg:justify-between px-4 my-5 md:my-2 h-16 ">
        <MobileSidebar/>
        <Back />
        <div>
          <DepartmentSwitcher items={department} className="hidden md:flex px-2" />
        </div>
        <MainNav className="hidden md:flex px-2" />
        <div className="ml-auto flex items-center space-x-4">
          <Notifications data={employees} />
          <UserButton afterSignOutUrl="/" />

        </div>
      </div>
    </div>
  );
}

// flex-col lg:flex-row 
