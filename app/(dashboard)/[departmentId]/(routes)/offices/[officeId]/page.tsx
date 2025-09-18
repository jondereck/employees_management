// app/(dashboard)/[departmentId]/(routes)/view/offices/[officeId]/page.tsx
import prismadb from "@/lib/prismadb";
import { OfficeForm } from "./components/office-form";
import getEmployees from "../../(frontend)/view/actions/get-employees";
// ← use an absolute, stable path

export const revalidate = 0;

interface PageProps {
  params: { departmentId: string; officeId: string };
  searchParams: { employeeTypeId?: string; eligibilityId?: string };
}

export default async function OfficesPage({ params, searchParams }: PageProps) {
  // Office (include billboard if your form shows it)
  const office = await prismadb.offices.findUnique({
    where: { id: params.officeId },
    include: { billboard: true }, // remove if not needed
  });

  // Billboards for the dropdown in the form (scoped by department)
  const billboards = await prismadb.billboard.findMany({
    where: { departmentId: params.departmentId },
  });



  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <OfficeForm initialData={office} billboards={billboards} /* employees={employees} */ />
      </div>
    </div>
  );
}
