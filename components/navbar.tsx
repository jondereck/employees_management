import { UserButton, auth } from "@clerk/nextjs";
import DepartmentSwitcher from "./department-switcher";
import { redirect } from "next/navigation";
import prismadb from "@/lib/prismadb";
import Back from "./back";
import Notifications from "@/app/(dashboard)/[departmentId]/(routes)/employees/components/notifications";
import { Employees } from "@/app/(dashboard)/[departmentId]/(routes)/(frontend)/view/types";
import MobileSidebar from "./mobile-sidebar";
import { MainNav } from "./main-nav";
import { apiUrlForEmployees } from "@/utils/api";




export const Navbar = async () => {
 const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const departments = await prismadb.department.findMany({ where: { userId } });
  const activeDeptId = departments[0]?.id;
  if (!activeDeptId) {
    // ...render minimal nav
    return /* ... */;
  }

  const url = apiUrlForEmployees(activeDeptId);
  const res = await fetch(url, { cache: "no-store" });

  let employees: Employees[] = [];
  try {
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      employees = await res.json();
    } else {
      console.error("Employees API failed:", res.status, await res.text());
    }
  } catch (e) {
    console.error("Employees API parse error:", e);
  }
  return (
    <div className="border-b ">
      <div className="flex items-center lg:justify-between px-4 my-5 md:my-2 h-16 ">
        <MobileSidebar/>
        <Back />
        <div>
          <DepartmentSwitcher items={departments} className="hidden md:flex px-2" />
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
