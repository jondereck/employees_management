import { UserButton, auth } from "@clerk/nextjs";
import { MainNav } from "./main-nav";
import DepartmentSwitcher from "./department-switcher";
import { redirect } from "next/navigation";
import prismadb from "@/lib/prismadb";
import MobileNavbar from "./mobile-sidebar";




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
  return (  
    <div className="border-b ">
      <div className="flex items-center lg:justify-between px-4 my-5 md:my-2 h-16 "> 
      <MobileNavbar />
        <div>
          <DepartmentSwitcher items={department}/>
        </div>
        <MainNav  className="hidden md:flex px-2"/>

       
        
        <div className="ml-auto flex items-center space-x-4">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div> 
    </div>
  );
}
 
// flex-col lg:flex-row 
