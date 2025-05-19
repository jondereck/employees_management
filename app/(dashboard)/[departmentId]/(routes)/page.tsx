import { getTotalEmployees } from "@/actions/get-total-employee";
import { getTotal } from "@/actions/get-total";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Award, Shield, ShieldCheck, ShieldEllipsis, ShieldOff, Star, Users } from "lucide-react";
import Overview from "@/components/overview";
import { getGraph } from "@/actions/get-graph";
import ClientEmployeeChange from "@/components/client-employee-change";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { CardListClient } from "@/components/ui/card-list-client";
import CameraScanner from "@/components/camera";
import CameraScannerWrapper from "@/components/camera-scanner-wrapper";


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
  ShieldEllipsis
};

const iconNameMap: Record<string, keyof typeof iconMap> = {
  Permanent: "ShieldCheck",
  Casual: "Shield",
  "Job Order": "ShieldOff",
  Coterminous: "Star",
  Elected: "Award",
  "Contract of Service": "ShieldEllipsis",
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

      const iconKey = iconNameMap[employeeType.name.trim()] || "Shield";
      const icon = iconMap[iconKey];
      const percent = Math.round((total / totalEmployee) * 100);

      const previousTotal = total - Math.floor(Math.random() * 5);
      const trend = total > previousTotal ? "↑" : total < previousTotal ? "↓" : "→";
      return {
        ...employeeType,
        total,
        icon,
        percent,
        trend

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* TOTAL EMPLOYEE CARD */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees  </CardTitle>
              <Users />
            </CardHeader>
            <CardContent >
              <div className="flex items-center space-x-1">
                <div className="text-2xl font-bold">{totalEmployee}  </div>
                <ClientEmployeeChange departmentId={params.departmentId} currentTotal={totalEmployee} />
              </div>
            </CardContent>
          </Card>


          {/* INDIVIDUAL EMPLOYEE TYPE CARDS */}
          {sortedTotals.map((employeeType) => (
            <Card key={employeeType.id}>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start space-y-2 sm:space-y-0 pb-2">
                <div className="flex-1">
                  <CardTitle className="text-sm font-medium">
                    {employeeType.name}
                    <span className="text-xs ml-1">
                      {employeeType.trend === "↑" && <span className="text-green-600">{employeeType.trend}</span>}
                      {employeeType.trend === "↓" && <span className="text-red-600">{employeeType.trend}</span>}
                      {employeeType.trend === "→" && <span className="text-gray-500">{employeeType.trend}</span>}
                    </span>
                  </CardTitle>
                </div>

                {employeeType.icon && (
                  <ActionTooltip
                    label={`${employeeType.name} - ${employeeType.total} employees`}
                    side="top"
                    align="center"
                  >
                    <div
                      className="p-2 sm:p-2 rounded-full self-start sm:self-center"
                      style={{ backgroundColor: `${employeeType.value}30` }}
                    >
                      <employeeType.icon
                        size={24}
                        className={`w-5 h-5 sm:w-6 sm:h-6 ${employeeType.color} group-hover:animate-bounce transition-transform duration-300`}
                        style={{ color: employeeType.value }}
                        strokeWidth={2}
                      />
                    </div>
                  </ActionTooltip>
                )}
              </CardHeader>

              <CardContent>
                <div className="text-2xl font-bold">{employeeType.total}</div>
                <p className="text-xs text-muted-foreground">{employeeType.percent}% of total employees</p>
              </CardContent>
            </Card>

          ))}
        </div>
        <div>
          {/* <CardListClient totals={sortedTotals} /> */}
        </div>

        {/* OVERVIEW CHART */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={graphEmployee} />
          </CardContent>
        </Card>
        <CameraScannerWrapper />
      </div>
    </div>
  );
};

export default DashboardPage;
