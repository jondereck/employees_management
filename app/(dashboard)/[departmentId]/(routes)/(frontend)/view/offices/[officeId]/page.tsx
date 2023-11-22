import getEligibility from "../../actions/get-eligibility";
import getEmployeeType from "../../actions/get-employee-type";
import getEmployees from "../../actions/get-employees";
import getOffice from "../../actions/get-office";
import getOffices from "../../actions/get-offices";
import Billboard from "../../components/billboard";
import Footer from "../../components/footer";
import Navbar2 from "../../components/navbar";
import Container from "../../components/ui/container";
import Filter from "./components/filter";



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
            {/*Mobile */}
            <div className="hidden lg:block">
              <Filter 
                valueKey="employeeType"
                name="Appointment"
                data={employeeType}
              />
              <Filter 
                valueKey=""
                name="Eligibility"
                data={eligibility}
              />
            </div>
          </div>
        </div>
        <Footer/>
      </Container>
    </div>
   );
}
 
export default OfficesPage;