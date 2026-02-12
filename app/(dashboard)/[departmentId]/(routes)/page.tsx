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
import { getMonthlyEmployeeActivity } from "@/actions/get-monthly-employee-activity";
import { getHeadcountTrend } from "@/actions/get-headcount-trend";
import HeadcountTrend from "@/components/headcount-trend";


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
  const { currentCount: currentMonthActivity, previousCount: previousMonthActivity } =
    await getMonthlyEmployeeActivity(departmentId);
  const headcountTrend = await getHeadcountTrend(departmentId);

  // 🧠 Map employeeTypes and get totals
  const totals = await Promise.all(
    dynamicEmployeeTypes.map(async (employeeType: any) => {
      const total = await getTotal(employeeType.id, departmentId);

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
     <div className="flex-1 space-y-4 p-4 lg:p-8 pt-6 bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-950 dark:to-slate-900 min-h-screen">
  <Heading title="Dashboard" description="Overview of your Employees" />
  <Separator className="bg-white/20" />

  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
    {/* TOTAL EMPLOYEE CARD */}
   <Card className="relative overflow-hidden group bg-white/10 dark:bg-white/[0.03] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-3xl transition-all duration-500 hover:bg-white/15 hover:shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
  
  {/* The "Liquid" Highlight - Adds a subtle sheen at the top */}
  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />

  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
    <CardTitle className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100 opacity-70 group-hover:opacity-100 transition-opacity">
      Total Employees
    </CardTitle>
    <div className="p-2.5 bg-blue-500/10 dark:bg-blue-400/10 rounded-xl ring-1 ring-blue-500/20 backdrop-blur-sm">
      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
    </div>
  </CardHeader>

  <CardContent className="relative z-10">
    <div className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
      {totalEmployee}
    </div>
    
    <div className="mt-2 flex items-center gap-1">
      <ClientEmployeeChange
        currentCount={currentMonthActivity}
        previousCount={previousMonthActivity}
        label="active this month"
       
      />
    </div>

    {/* Decorative Liquid Element */}
    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />
  </CardContent>
</Card>

    {/* INDIVIDUAL EMPLOYEE TYPE CARDS */}
    {sortedTotals.map((employeeType) => (
      <Card 
        key={employeeType.id} 
        className="bg-white/10 dark:bg-black/20 backdrop-blur-lg border border-white/30 dark:border-white/10 shadow-xl rounded-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl"
      >
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start space-y-2 sm:space-y-0 pb-2">
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold opacity-90">
              {employeeType.name}
              <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full bg-white/20">
                {employeeType.trend === "↑" && <span className="text-green-500">{employeeType.trend}</span>}
                {employeeType.trend === "↓" && <span className="text-red-500">{employeeType.trend}</span>}
                {employeeType.trend === "→" && <span className="text-gray-400">{employeeType.trend}</span>}
              </span>
            </CardTitle>
          </div>

          {employeeType.icon && (
            <ActionTooltip label={`${employeeType.name}`} side="top">
              <div
                className="p-2.5 rounded-xl backdrop-blur-sm border border-white/10 shadow-inner"
                style={{ 
                    backgroundColor: `${employeeType.value}20`,
                    boxShadow: `0 0 15px ${employeeType.value}30` 
                }}
              >
                <employeeType.icon
                  size={20}
                  className="transition-transform duration-500 group-hover:scale-110"
                  style={{ color: employeeType.value }}
                />
              </div>
            </ActionTooltip>
          )}
        </CardHeader>

        <CardContent>
          <div className="text-2xl font-bold">{employeeType.total}</div>
          <div className="mt-1 w-full bg-white/10 h-1 rounded-full overflow-hidden">
             <div 
                className="h-full bg-current opacity-60" 
                style={{ width: `${employeeType.percent}%`, backgroundColor: employeeType.value }} 
             />
          </div>
          <p className="text-[10px] mt-2 uppercase tracking-widest opacity-60 font-semibold">
            {employeeType.percent}% Distribution
          </p>
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
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Headcount Trend by Employee Type</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <HeadcountTrend data={headcountTrend.data} series={headcountTrend.series} />
          </CardContent>
        </Card>
        <CameraScannerWrapper />
      </div>
    </div>
  );
};

export default DashboardPage;
