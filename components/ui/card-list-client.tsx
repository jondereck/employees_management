"use client"

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Award, Shield, ShieldCheck, ShieldEllipsis, ShieldOff, Star, Users } from "lucide-react";

export const CardListClient = ({ totals }: { totals: any[] }) => {
  const [filter, setFilter] = useState<string | null>(null);

  // Define the icon map
  const iconMap: Record<string, any> = {
    ShieldCheck,
    Shield,
    ShieldOff,
    Star,
    Award,
    ShieldEllipsis,
    Users, // Add Users or any other icons here if needed
  };

  const iconNameMap: Record<string, keyof typeof iconMap> = {
    Permanent: "ShieldCheck",
    Casual: "Shield",
    "Job Order": "ShieldOff",
    Coterminous: "Star",
    Elected: "Award",
    "Contract of Service": "ShieldEllipsis",
  };
  
  
  // Filter logic
  const filteredTotals = useMemo(() => {
    if (!filter) return totals;
    return totals.filter((type) => type.name === filter);
  }, [filter, totals]);

  return (
    <div className="space-y-4">
      {filter && (
        <button
          onClick={() => setFilter(null)}
          className="text-sm underline text-blue-600 hover:text-blue-800"
        >
          Clear Filter
        </button>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredTotals.map((employeeType) => {
          // Ensure the icon is mapped correctly based on the iconKey from employeeType
          const Icon = iconMap[employeeType.iconKey || "Shield"]; // Default to "Shield" if no iconKey is provided

          return (
            <Card
              key={employeeType.id}
              onClick={() => setFilter(employeeType.name)}
              className="cursor-pointer hover:shadow-md transition"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{employeeType.name}</CardTitle>
                {employeeType.icon && (
                  <ActionTooltip
                    label={`${employeeType.name} – ${employeeType.total} employees`}
                    side="top"
                    align="center"
                  >
                    {/* Using the dynamic Icon component */}
                    <Icon className={employeeType.color} />
                  </ActionTooltip>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employeeType.total}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
