import { getTotalEmployees } from "@/actions/get-total-employee";
import { getTotal } from "@/actions/get-total";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Award, Shield, ShieldCheck, ShieldOff, Star, Users } from "lucide-react";
import Overview from "@/components/overview";
import { getGraph } from "@/actions/get-graph";

interface DashboardProps {
  params: { departmentId: string; officeId: string };
}

// Map icon names from DB to actual components
const iconMap: Record<string, any> = {
  ShieldCheck,
  Shield,
  ShieldOff,
  Star,
  Award,
};

const colorMap: Record<string, string> = {
  Permanent: "text-green-500",
  Casual: "text-blue-500",
  "Job Order": "text-violet-500",
  Coterminous: "text-yellow-600",
  Elected: "text-red-600",
};



const DashboardPage = async ({ params }: DashboardProps) => {
  const { departmentId } = params;

  // 🔄 Dynamically fetch employee types from API route
  const res = await fetch(`${process.env.NEXT_PRIVATE_API_URL}/${departmentId}/employee_type`, {
    cache: "no-store",
  });
  

  const dynamicEmployeeTypes = await res.json();

  // 🧮 Fetch total employee count
  const totalEmployee = await getTotalEmployees(departmentId);
  const graphEmployee = await getGraph(departmentId);

  // 🧠 Map employeeTypes and get totals
  const totals = await Promise.all(
    dynamicEmployeeTypes.map(async (employeeType: any) => {
      const total = await getTotal(employeeType.id);
      return {
        ...employeeType,
        total,
        icon: iconMap[employeeType.icon || "Shield"], // fallback
        color: colorMap[employeeType.name] || "text-gray-500", // fallback
      };
    })
  );
  const customOrder = ["permanent", "casual", "job order", "elected", "coterminous"];

  const sortedTotals = totals.sort((a, b) => {
    const aIndex = customOrder.indexOf(a.name.trim().toLowerCase());
    const bIndex = customOrder.indexOf(b.name.trim().toLowerCase());
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
  

  
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
           {/* Render sorted employee types */}
           {sortedTotals.map((employeeType) => (
            <Card key={employeeType.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{employeeType.name}</CardTitle>
                {employeeType.icon && <employeeType.icon className={employeeType.color} />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employeeType.total}</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={graphEmployee} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
