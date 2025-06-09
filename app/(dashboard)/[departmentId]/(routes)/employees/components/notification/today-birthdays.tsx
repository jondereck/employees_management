import usePreviewModal from "../../../(frontend)/view/hooks/use-preview-modal";
import { EmployeesColumn } from "../columns";

export const TodaysBirthdays = ({ celebrantsToday, closeParentModal }: { celebrantsToday: EmployeesColumn[];   closeParentModal?: () => void; }) => {
  const handleOpenPreview = (emp: EmployeesColumn) => {
    if (closeParentModal) closeParentModal();
    usePreviewModal.getState().onOpen(emp);
  };

  if (!celebrantsToday.length) {
    return <p className="text-sm text-gray-500 text-center">No birthdays today</p>;
  }

  return (
     <ul className="space-y-2">
      {celebrantsToday.map((emp, index) => (
        <li
          key={index}
          className="flex items-center justify-between p-2 border-b border-gray-200 hover:bg-gray-50 rounded-md"
        >
          <button
            onClick={() => handleOpenPreview(emp)}
            className="text-sm text-blue-600 font-medium hover:underline focus:outline-none"
          >
            {emp.firstName} {emp.lastName}
          </button>
        </li>
      ))}
    </ul>
  );
};
