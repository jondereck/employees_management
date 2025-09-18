// app/(dashboard)/[departmentId]/(routes)/(frontend)/view/employee/[employeeId]/page.tsx
import Gallery from "../../components/gallery";
import getEmployee from "../../actions/get-employee";
import getEmployees from "../../actions/get-employees";
import Container from "../../components/ui/container";
// import EmployeeList from "../../components/ui/employee-list";
import Info from "../../components/ui/info";
import Footer from "../../components/footer";
import CameraScannerWrapper from "@/components/camera-scanner-wrapper";
import { notFound } from "next/navigation";

export const revalidate = 0;

interface PageProps {
  params: {
    departmentId: string;
    employeeId: string;
  };
}

export default async function EmployeeInvdividualPage({ params }: PageProps) {
  const employee = await getEmployee(params.departmentId, params.employeeId);



  // If the API returns null/undefined for an invalid ID
  if (!employee) {
    notFound(); // or return a friendly message div
  }

  // Prefer scalar if available, fall back to relation
   const officeId = employee.offices?.id ?? null;
   
  const suggestedPeople = officeId
    ? await getEmployees(params.departmentId, { officeId })
    : [];

  return (
    <div className="bg-white">
      <Container>
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-x-12">
            {/* Profile Image / Gallery */}
            <div className="w-full max-w-xs mx-auto lg:mx-0">
              <div className="overflow-hidden rounded-xl border shadow-sm bg-white">
                <Gallery images={employee.images ?? []} />
              </div>
            </div>

            {/* Profile Info */}
            <div className="mt-8 lg:mt-0 flex-1">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold mb-6">
                  Employee Information
                </h2>
                <Info data={employee} />
              </div>
            </div>
          </div>

          {/* If you want to show related personnel later */}
          {/* <EmployeeList title="Related Personnel" items={suggestedPeople} /> */}
        </div>

        <CameraScannerWrapper />
        <Footer />
      </Container>
    </div>
  );
}
