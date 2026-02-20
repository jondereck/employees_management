import { Cake, ChevronRight } from "lucide-react";
import usePreviewModal from "../../../(frontend)/view/hooks/use-preview-modal";
import { EmployeesColumn } from "../columns";

export const TodaysBirthdays = ({ celebrantsToday, closeParentModal }: { celebrantsToday: EmployeesColumn[]; closeParentModal?: () => void; }) => {
  const handleOpenPreview = (emp: EmployeesColumn) => {
    if (closeParentModal) closeParentModal();
    usePreviewModal.getState().onOpen(emp);
  };

  if (!celebrantsToday.length) {
    return <p className="text-sm text-gray-500 text-center">No birthdays today</p>;
  }

  return (
    <ul className="space-y-3">
      {celebrantsToday.map((emp, index) => (
        <li
          key={index}
          className="group flex items-center justify-between p-3 bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl transition-all duration-300 active:scale-[0.97] hover:bg-white/60 hover:shadow-lg hover:shadow-pink-500/10"
        >
          <button
            onClick={() => handleOpenPreview(emp)}
            className="flex items-center gap-3 text-left focus:outline-none min-w-0 flex-1"
          >
            {/* Avatar with Celebration Ring */}
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-pink-500 via-purple-500 to-orange-400 p-[2px] animate-gradient-xy">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[11px] font-black text-slate-800">
                  {emp.firstName[0]}{emp.lastName[0]}
                </div>
              </div>
              {/* Miniature Birthday Icon Badge */}
              <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-1 shadow-sm border border-slate-100">
                <Cake className="h-2.5 w-2.5 text-pink-500" />
              </div>
            </div>

            {/* Text Content */}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-800 truncate group-hover:text-pink-600 transition-colors">
                {emp.firstName} {emp.lastName}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-pink-500/80">
                {"It's their day! 🎂"}
              </span>
            </div>
          </button>

          {/* Action Area */}
          <div className="ml-2 shrink-0 flex items-center gap-2">
            {/* Subtle "Wish" Indicator for Mobile UX */}
            <span className="hidden sm:inline-block text-[10px] font-bold text-slate-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
              View Profile
            </span>
            <div className="p-2 bg-pink-50 rounded-xl group-hover:bg-pink-500 transition-all duration-300">
              <ChevronRight className="h-4 w-4 text-pink-500 group-hover:text-white" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};
