import prismadb from "@/lib/prismadb";
import {OfficeForm } from "./components/office-form";

const OfficesPage = async ({
  params
}: {
  params: { officeId: string, departmentId: string }
}) => {
  const offices = await prismadb.offices.findUnique ({
    where: {
      id: params.officeId
    }
  });

  const billboards = await prismadb.billboard.findMany({
    where: {
      departmentId: params.departmentId
    }
  })


  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
      <OfficeForm initialData={offices} billboards={billboards}/>
      </div>
    </div>
  );
}

export default OfficesPage;