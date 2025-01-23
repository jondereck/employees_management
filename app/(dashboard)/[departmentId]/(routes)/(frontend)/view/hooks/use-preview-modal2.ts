// import { create } from "zustand";
// import { EmployeesColumn } from "../../../employees/components/columns";


// interface PreviewModalStore {
//   isOpen: boolean;
//   data?: Employees;
//   onOpen: (data: EmployeesColumn) => void;
//   onClose: () => void;
// };

// const usePreviewModal2 = create<PreviewModalStore>((set) => ({
//   isOpen: false,
//   data: undefined,
//   onOpen: (data: EmployeesColumn) => set({isOpen: true, data}),
//   onClose: () => set({ isOpen: false})
// }));

// export default usePreviewModal2;