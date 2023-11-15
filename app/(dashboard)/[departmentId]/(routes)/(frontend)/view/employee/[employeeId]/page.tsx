import { Separator } from "@/components/ui/separator";

import Gallery from "../../components/gallery";

import getEmployee from "../../actions/get-employee";
import getEmployees from "../../actions/get-employees";
import Container from "../../components/ui/container";
import EmployeeList from "../../components/ui/employee-list";

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
          <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
            <Gallery images={employee.images} />
            <div className="mt-10 sm:mt-16 sm:px-0 lg:mt-0">
              Information
            </div>
          </div>
        <hr className="my-10" />
        <EmployeeList title="Related Personel" items={suggestedPeople} />
        </div>
      </Container>
     
    </div>
  );
}

export default EmployeeInvdividualPage;