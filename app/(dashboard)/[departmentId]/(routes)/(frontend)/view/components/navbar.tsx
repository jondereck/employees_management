import Link from "next/link";
import Container from "./ui/container";
import MainNav from "./main-nav";
import getOffices from "../actions/get-offices";
import NavbarActions from "./navbar-actions";

export const revalidate = 0;

const Navbar2 = async () => {
  const offices = await getOffices();
  return (
    <div className="border-b">
      <Container>
       <div className="relative flex px-4 sm:px-6 lg:px-8 h-16 items-center overflow-auto">
       <Link href={`/${process.env.HOMEPAGE}/view`} className="ml-4 flex  lg:ml-0 gap-x-2">
          <p className="font-semibold font-sans text-xl">Employees </p>
       
        </Link>
       <MainNav data={offices}/>
       <NavbarActions />
       </div>
      </Container>
    </div>
  );
}

export default Navbar2;
