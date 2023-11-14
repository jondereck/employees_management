import { Employees } from "../../types";
import EmployeeCard from "./employee-card";
import NoResults from "./no-results";


interface EmployeeListProps {
  title: string;
  items: Employees[];
}

const EmployeeList = ({
  title,
  items,
}: EmployeeListProps) => {
  return (
    <div className="space-y-4 ">
      <h3 className="font-bold text-3xls">{title}</h3>
      {items.length === 0 && <NoResults/>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <EmployeeCard key={item.id} data={item} />
        ))}
      </div>
    </div>
  );
}

export default EmployeeList;