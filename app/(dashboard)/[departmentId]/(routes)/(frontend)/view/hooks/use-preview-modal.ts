import { create } from "zustand";
import { Employees } from "../types";
import { EmployeesColumn } from "../../../employees/components/columns";


interface PreviewModalStore {
  isOpen: boolean;
  data?: Employees | EmployeesColumn;
  onOpen: (data:  Employees | EmployeesColumn) => void;
  onClose: () => void;
};

const usePreviewModal = create<PreviewModalStore>((set) => ({
  isOpen: false,
  data: undefined,
  onOpen: (data:  Employees | EmployeesColumn) => set({isOpen: true, data}),
  onClose: () => set({ isOpen: false})
}));

export default usePreviewModal;