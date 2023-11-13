
import { Navbar } from "@/components/navbar";
import Footer from "./components/footer";
import Navbar2 from "./components/navbar";
import Container from "./components/ui/container";
import Billboard from "./components/billboard";
import getBillboard from "./actions/get-billboard";

export const revalidate = 0;

const Hompage = async () => {

  const billboard = await getBillboard("e2857486-84df-48ab-a342-26fd832e179b")
  return (
    <Container>
      <div className="space-y-10 pb-10">
        <Navbar />
        <Navbar2 />
        <Billboard data={billboard} />
        <Footer />
      </div>
    </Container>
  );
}

export default Hompage;