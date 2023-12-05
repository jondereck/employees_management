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



export const revalidate = 0;

interface OfficesPageProps {
  params: {
    officeId: string
  },
  searchParams: {
    employeeTypeId: string;
    eligibilityId: string;

  }
}

const OfficesPage = async ({
  params,
  searchParams
}: OfficesPageProps) => {
  const officeId = params.officeId;
  const total = await getEmployeeTypeCountsByOffice(officeId);
  const totalEligibility = await getEligibilityCountsByOffice(officeId)
  const employees = await getEmployees({
    officeId: params.officeId,
    employeeTypeId: searchParams.employeeTypeId,
    eligibilityId: searchParams.eligibilityId,
  });

  const employeeType = await getEmployeeType();
  const eligibility = await getEligibility();
  const office = await getOffice(params.officeId);


  return (
    <div className="bg-white">
      <Container>
        <Navbar2 />
        <Billboard
          data={office.billboard}
          offices={office}
        />
        <div className="px-4 sm:px-6 lg:px-8 pb-24">
          <div className="lg:grid lg:grid-cols-5 lg:gap-x-8">
            <MobileFilter employeeType={employeeType} eligibility={eligibility} />
          
            <div className="hidden lg:block">
            <SearchInput
            
            />
              <Filter
                officeId={officeId}
                total={total}
                valueKey="employeeTypeId"
                name="Appointment"
                data={employeeType}
              />
              <Filter
              officeId={officeId}
              total={totalEligibility}
                valueKey="eligibilityId"
                name="Eligibility"
                data={eligibility}
              /> 
            </div>
            <div className="mt-6 lg:col-span-4 lg:mt-0">
              {employees.length === 0 && <NoResults />}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {employees.map((item) => (
                  <EmployeeCard 
                    key={item.id}
                    data={item}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </Container>
    </div>
  );
}

export default OfficesPage;