
import { getTotalEmployees } from "@/actions/get-total-employee";
import { getTotal } from "@/actions/get-total";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Shield, ShieldCheck, ShieldOff, Star, Users } from "lucide-react";
import { PersonIcon } from "@radix-ui/react-icons";
import { EmployeeType } from "./(frontend)/view/types";



interface DashboardProps {
  params: { departmentId: string; officeId: string };
}

const DashboardPage = async ({ params }: DashboardProps) => {

  const employeeTypes = [
    {
      id: 'aeaf6a42-2586-46c3-bb2a-0464be2e5ba7',
      name: 'Permanent',
      icon: ShieldCheck,
      color: 'text-green-500'
    },
    {
      id: '07eb3541-f2c8-4482-843e-0aacc0197992',
      name: 'Casual',
      icon: Shield,
      color: 'text-blue-500'
    },
    {
      id: 'd5c55388-fd2b-4bc5-817a-c2a987e97be8',
      name: 'Job Order',
      icon: ShieldOff,
      color: 'text-violet-500'
    },
    {
      id: '10f6c11b-a1b4-4664-947b-5474380a7fbb',
      name: 'Coterminous',
      icon: Star,
      color: 'text-yellow-600'
    },
  ];

  const totalEmployee = await getTotalEmployees(params.departmentId);

  const totals = await Promise.all(
    employeeTypes.map(async (employeeType) => {
      const total = await getTotal(employeeType.id);
      return { ...employeeType, total };
    })
  );

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-4 lg:p-8 pt-6">

        <Heading title="Dashboard" description="Overview of your Employees" />
        <Separator />
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employee</CardTitle>
              <Users />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEmployee}</div>
            </CardContent>
          </Card>
          {totals.map((employeeType) => (
            <Card key={employeeType.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-sm font-medium `}>
                  {employeeType.name}
                </CardTitle>
                {employeeType.icon && <employeeType.icon className={employeeType.color} />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employeeType.total}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;