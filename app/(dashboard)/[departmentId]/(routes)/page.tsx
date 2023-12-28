import { getTotalCasual } from "@/actions/get-total-casual";
import { getTotalEmployees } from "@/actions/get-total-employee";
import { getTotalJobOrder } from "@/actions/get-total-joborder";
import { getTotalPermanent } from "@/actions/get-total-permanent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Shield, ShieldCheck, ShieldOff, User, User2, UserCheck2, UserPlus, Users } from "lucide-react";
import { useParams } from "next/navigation";

interface DashboardProps {
  params: { departmentId: string, officeId: string };
}

const DashboardPage = async ({
  params,
}: DashboardProps) => {

  const permanent = 'aeaf6a42-2586-46c3-bb2a-0464be2e5ba7';
  const casual = '07eb3541-f2c8-4482-843e-0aacc0197992';
  const jobOrder = 'd5c55388-fd2b-4bc5-817a-c2a987e97be8';

  const totalEmployee = await getTotalEmployees(params.departmentId);
  const totalPermanent = await getTotalPermanent(permanent);
  const totalCasual = await getTotalCasual(casual);
  const totalJobOrder = await getTotalJobOrder(jobOrder);


  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 lg:p-8 pt-6">
        <Heading
          title="Dashboard"
          description="Overview of your Employees"
        />
        <Separator />
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Employee
              </CardTitle>
              <Users />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalEmployee}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Permanent
              </CardTitle>
              <ShieldCheck  className="text-green-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalPermanent}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Casual
              </CardTitle>
              <Shield  className="text-blue-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalCasual}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Job Order 
              </CardTitle>
              <ShieldOff />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalJobOrder}
              </div>
            </CardContent>
          </Card>

        </div>

      </div>
    </div>
  );
}

export default DashboardPage;