import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function DashboardLayout ({
  children,
  params
}: {
  children: React.ReactNode;
  params: { departmentId: string}
}) {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in')
  }

  const department = await prismadb.department.findFirst({
    where: {
      id: params.departmentId,
      userId
    }
  });

  if (!department) {
    redirect('/');
  }

  return (
    <>
      <div>
        This will be a Navbar
        {children}
      </div>    
    </>
  )
}