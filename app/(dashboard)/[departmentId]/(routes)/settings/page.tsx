import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { SettingsForm } from "./components/settings-form";

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
    <div className="flex-col">
      <div className="flex-1 space-y-4  p-8 pt-6">
        <SettingsForm initialData={department}/>
      </div>
    </div>);
}

export default SettingsPage;