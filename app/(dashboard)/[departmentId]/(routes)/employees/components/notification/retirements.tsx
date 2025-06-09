import { getSortedRetirees, isRetirementNextYear } from "@/utils/notification-utils";
import { EmployeesColumn } from "../columns";


interface RetirementsProps {
  retirees: EmployeesColumn[];
}

export const Retirements = ({ retirees }: RetirementsProps) => {
  const sorted = getSortedRetirees(retirees);

  return (
    <ul className="space-y-2">
      {sorted.map((emp, index) => {
        const birthDate = new Date(emp.birthday);
        const formatted = birthDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

        return (
          <li
            key={index}
            className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
          >
            <span
              className={`text-sm font-medium ${isRetirementNextYear(emp.birthday)
                ? "text-green-600"
                : "text-gray-800"
              }`}
            >
              {emp.firstName} {emp.lastName}
            </span>
            <span className="text-xs text-gray-500">Turns 65 on {formatted}</span>
          </li>
        );
      })}
    </ul>
  );
};
