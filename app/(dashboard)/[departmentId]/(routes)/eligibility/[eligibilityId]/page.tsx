import prismadb from "@/lib/prismadb";
import { EligibilityForm } from "./components/eligibility-form";
;

const EligibilityPage = async ({
  params
}: {
  params: { eligibilityId: string }
}) => {
  const eligibility = await prismadb.eligibility.findUnique ({
    where: {
      id: params.eligibilityId
    }
  });

  

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
      <EligibilityForm initialData={eligibility}/>
      </div>
    </div>
  );
}

export default EligibilityPage;