import { create } from "zustand";
import { Employees } from "../types";



interface PreviewModalStore {
  isOpen: boolean;
  data?: Employees ;
  onOpen: (data:  Employees ) => void;
  onClose: () => void;
};

const usePreviewModal = create<PreviewModalStore>((set) => ({
  isOpen: false,
  data: undefined,
  onOpen: (data:  Employees ) => set({isOpen: true, data}),
  onClose: () => set({ isOpen: false})
}));

export default usePreviewModal;