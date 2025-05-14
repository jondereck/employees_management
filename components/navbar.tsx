import { UserButton, auth } from "@clerk/nextjs";
import { MainNav } from "./main-nav";
import DepartmentSwitcher from "./department-switcher";
import { redirect } from "next/navigation";
import prismadb from "@/lib/prismadb";
import MobileNavbar from "./mobile-sidebar";
import Back from "./back";
import Notifications from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notifications";


interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  birthday: string;
  dateHired: string;
  isArchived: boolean;
}

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
  const employees: Employee[] = await res.json();

  return (
    <div className="border-b ">
      <div className="flex items-center lg:justify-between px-4 my-5 md:my-2 h-16 ">
        <MobileNavbar />
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
