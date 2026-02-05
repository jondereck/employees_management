"use client";

import { create } from "zustand";
import { Employees } from "../types";
import { EmployeesColumn } from "../../../employees/components/columns";

interface PreviewModalStore {
  isOpen: boolean;

  // fast table data
  previewData?: EmployeesColumn;

  // hydrated full data
  fullData?: Employees;

  onOpen: (data: EmployeesColumn) => void;
  onClose: () => void;

  setFullData: (data: Employees) => void;
}

const usePreviewModal = create<PreviewModalStore>((set) => ({
  isOpen: false,
  previewData: undefined,
  fullData: undefined,

  onOpen: (data) =>
    set({
      isOpen: true,
      previewData: data,
      fullData: undefined, // 🔥 CLEAR OLD EMPLOYEE IMMEDIATELY
    }),

  onClose: () =>
    set({
      isOpen: false,
      previewData: undefined,
      fullData: undefined,
    }),

  setFullData: (data) =>
    set({
      fullData: data,
    }),
}));

export default usePreviewModal;
