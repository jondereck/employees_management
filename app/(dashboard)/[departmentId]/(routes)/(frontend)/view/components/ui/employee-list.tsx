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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 space-x-2">
        {items.map((item) => (
          <EmployeeCard key={item.id} data={item} />
        ))}
      </div>
    </div>
  );
}

export default EmployeeList;