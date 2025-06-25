// hooks/use-loading-store.ts
import { create } from 'zustand';

type LoadingStore = {
  isLoading: boolean;
  setLoading: (value: boolean) => void;
};


const useLoadingStore = create<LoadingStore>((set) => ({
  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
}));


export default useLoadingStore;
