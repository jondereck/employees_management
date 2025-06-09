import React from "react";

interface Employee {
  firstName: string;
  lastName: string;
  dateHired: string;
}

interface AnniversariesProps {
  milestoneAnniversaries: Employee[];
  limit?: number;
}

const currentYear = new Date().getFullYear();

const isNextYearAnniversary = (dateHired: string) => {
  const date = new Date(dateHired);
  return date.getFullYear() === currentYear + 1;
};

const getSortedMilestones = (employees: Employee[]) => {
  const today = new Date();

  return [...employees].sort((a, b) => {
    const aDate = new Date(a.dateHired);
    const bDate = new Date(b.dateHired);

    // Compare MM-DD only, not year
    const aMonthDay = new Date(today.getFullYear(), aDate.getMonth(), aDate.getDate());
    const bMonthDay = new Date(today.getFullYear(), bDate.getMonth(), bDate.getDate());

    const todayMonthDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const aIsUpcoming = aMonthDay >= todayMonthDay;
    const bIsUpcoming = bMonthDay >= todayMonthDay;

    if (aIsUpcoming && !bIsUpcoming) return -1;
    if (!aIsUpcoming && bIsUpcoming) return 1;

    // If both same status, sort by date ascending
    return aMonthDay.getTime() - bMonthDay.getTime();
  });
};


export const Anniversaries: React.FC<AnniversariesProps> = ({
  milestoneAnniversaries,
  limit,
}) => {
  const sorted = getSortedMilestones(milestoneAnniversaries);
  const displayed = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="space-y-2">
      {displayed.map((emp, index) => {
        const hireDate = new Date(emp.dateHired);
        const years = currentYear - hireDate.getFullYear();
        const formatted = hireDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        return (
          <div
            key={index}
            className="flex items-center justify-between p-2 border-b border-gray-200"
          >
            <span
              className={`text-sm font-medium ${
                isNextYearAnniversary(emp.dateHired)
                  ? "text-green-600"
                  : "text-gray-800"
              }`}
            >
              {emp.firstName} {emp.lastName}
            </span>
            <span className="text-xs text-gray-500">
              {years} years on {formatted}
            </span>
          </div>
        );
      })}
    </div>
  );
};
