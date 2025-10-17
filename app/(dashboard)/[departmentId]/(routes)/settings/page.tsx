import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { SettingsForm } from "./components/settings-form";
import SettingsFooter from "./components/settings-footer";
import { Separator } from "@/components/ui/separator";

interface settingsPageProps {
  params: {
    departmentId: string;
  }
}

const SettingsPage = async ({
  params
}: settingsPageProps) => {
  const { userId } = auth();



  if (!userId) {
    redirect("/sign-in");
  }



  // You'll need to fetch an employee or decide which one this refers to:
  const employee = await prismadb.employee.findFirst({
    where: { departmentId: params.departmentId },
    select: { id: true, publicEnabled: true },
  });

  const department = await prismadb.department.findFirst({
    where: {
      id: params.departmentId,
      userId
    }
  });

  if (!department) {
    redirect("/");
  }

  return (
    <div className="flex flex-col min-h-screen">

      <div className="flex-1 space-y-4 p-8 pt-6">
        <SettingsForm initialData={department} />
      </div>
      <Separator />

      <div className="flex justify-center p-2 ">
        <SettingsFooter />

      </div>
    </div>
  );
}

export default SettingsPage;