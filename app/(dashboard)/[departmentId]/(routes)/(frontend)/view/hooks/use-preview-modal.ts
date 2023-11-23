import { create } from "zustand";
import { Employees } from "../types";

interface PreviewModalStore {
  isOpen: boolean;
  data?: Employees;
  onOpen: (data: Employees) => void;
  onClose: () => void;
};

const usePreviewModal = create