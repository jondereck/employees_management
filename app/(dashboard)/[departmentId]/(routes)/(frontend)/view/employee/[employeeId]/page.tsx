import { Separator } from "@/components/ui/separator";

import Gallery from "../../components/gallery";

import getEmployee from "../../actions/get-employee";
import getEmployees from "../../actions/get-employees";
import Container from "../../components/ui/container";
import EmployeeList from "../../components/ui/employee-list";
import Info from "../../components/ui/info";
import Footer from "../../components/footer";

export const revalidate = 0;

interface EmployeeInvdividualPage {
  params: {
    employeeId: string;
  },
}

const EmployeeInvdividualPage = async ({
  params
}: EmployeeInvdividualPage) => {
  const employee = await getEmployee(params.employeeId);
  const suggestedPeople = await getEmployees({
    officeId: employee?.offices?.id
  })
  return (
    <div className="bg-white">
      <Container>
        <div className="px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-x-12">

            {/* Profile Image / Gallery */}
            <div className="w-full max-w-xs mx-auto lg:mx-0">
              <div className="overflow-hidden rounded-xl border shadow-sm bg-white">
                <Gallery images={employee.images} />
              </div>
            </div>

            {/* Profile Info */}
            <div className="mt-8 lg:mt-0 flex-1">
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 relative inline-block px-6 py-2 bg-primary text-white rounded-r-lg shadow-md before:absolute before:content-[''] before:left-0 before:top-1/2 before:-translate-y-1/2 before:-ml-4 before:border-y-[12px] before:border-l-[12px] before:border-y-transparent before:border-l-primary" >
                  🎖️ Employee Information
                </h2>

                <Info data={employee} />
              </div>
            </div>
          </div>

          {/* Optionally include related personnel */}
          {/* <EmployeeList title="Related Personnel" items={suggestedPeople} /> */}
        </div>
        <Footer/>
      </Container>

    

    </div>
  );
}

export default EmployeeInvdividualPage;