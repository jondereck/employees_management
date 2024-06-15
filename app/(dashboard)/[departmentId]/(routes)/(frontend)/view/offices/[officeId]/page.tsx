import getEligibility from "../../actions/get-eligibility";
import getEmployeeType from "../../actions/get-employee-type";
import getEmployees from "../../actions/get-employees";
import getOffice from "../../actions/get-office";
import getOffices from "../../actions/get-offices";
import { getEmployeeTypeCountsByOffice } from "../../actions/get-employee-type-by-offices";
import Billboard from "../../components/billboard";
import Footer from "../../components/footer";
import Navbar2 from "../../components/navbar";
import SearchInput from "../../components/search-bar";
import Container from "../../components/ui/container";
import EmployeeCard from "../../components/ui/employee-card";
import NoResults from "../../components/ui/no-results";
import Filter from "./components/filter";
import MobileFilter from "./components/mobile-filter";
import { getEligibilityCountsByOffice } from "../../actions/get-eligibility-by-offices";
import EmployeeList from "./components/employee-list-view";
import { getEmployeeCountsByOffice } from "../../actions/get-employee-counts-office";



export const revalidate = 0;

interface OfficesPageProps {
  params: {
    officeId: string
  },
  searchParams: {
    employeeTypeId: string;
    eligibilityId: string;
    isArchived: boolean;

  }
}

const OfficesPage = async ({
  params,
  searchParams
}: OfficesPageProps) => {
  const officeId = params.officeId;
  const employeeCounts = await getEmployeeCountsByOffice(officeId);
  const totalEmployeeCount = employeeCounts.find((count) => count.id === officeId)?.count || 0;

  const total = await getEmployeeTypeCountsByOffice(officeId);
  const totalEligibility = await getEligibilityCountsByOffice(officeId);


  const employees = await getEmployees({
    officeId: params.officeId,
    employeeTypeId: searchParams.employeeTypeId,
    eligibilityId: searchParams.eligibilityId,
    isArchived: searchParams.isArchived,
  });

  const employeeType = await getEmployeeType();
  const eligibility = await getEligibility();
  const office = await getOffice(params.officeId);

  const isArchived = searchParams.isArchived || false; 


  return (
    <div className="bg-white">
      <Container>
        <Navbar2 />

        <Billboard
          data={office.billboard}
          offices={office}
        />
        <div className="mx-8 mb-5 lg:text-2xl text-sm flex font-semibold border-b-2 ">
          {/* Display total employee count */}
          <p className="font-bold">
              Total Employee(s): {typeof totalEmployeeCount === 'object' ? totalEmployeeCount._all : totalEmployeeCount}
          </p>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pb-24">
          <div className="lg:grid lg:grid-cols-5 lg:gap-x-8">


            {/* <MobileFilter
              employeeType={employeeType}
              eligibility={eligibility}
              officeId={officeId}
              total={total}
              totalEligibility={totalEligibility}
            /> */}

            <div className="hidden lg:block">
              <Filter
                officeId={officeId}
                total={total}
                valueKey="employeeTypeId"
                name="Appointment"
                data={employeeType}
                isArchived={isArchived}
              />
              <Filter
                officeId={officeId}
                total={totalEligibility}
                valueKey="eligibilityId"
                name="Eligibility"
                data={eligibility}
                isArchived={isArchived}
              />
            </div>
            <div className="mt-6 lg:col-span-4 lg:mt-0">
              <EmployeeList items={employees} />
            </div>
          </div>
        </div>

        <Footer />
      </Container>
    </div>
  );
}

export default OfficesPage;