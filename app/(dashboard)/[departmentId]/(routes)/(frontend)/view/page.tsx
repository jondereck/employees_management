
import { Navbar } from "@/components/navbar";
import Footer from "./components/footer";
import Navbar2 from "./components/navbar";
import Container from "./components/ui/container";
import Billboard from "./components/billboard";
import getBillboard from "./actions/get-billboard";
import getEmployees from "./actions/get-employees";
import EmployeeList from "./components/ui/employee-list";

export const revalidate = 0;

const Hompage = async () => {
  const employees = await getEmployees({ isFeatured: true });
  const billboard = await getBillboard("e2857486-84df-48ab-a342-26fd832e179b");
  return (
    <Container>
      <div className="space-y-10 pb-10">
        <Navbar2 />
        <Billboard data={billboard} />
        
      </div>
      <div className="flex flex-col gap-y-8 px-4 sm:px-6 lg:px-8">
      <EmployeeList title="Featured " items={employees} />
      </div>
      <Footer />
    </Container>
  );
}

export default Hompage;