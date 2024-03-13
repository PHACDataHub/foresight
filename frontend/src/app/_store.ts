import { create } from "zustand";

export interface ForesightStore {
  history?: 3 | 7 | 30;
  setHistory: (history?: 3 | 7 | 30) => void;
  searchTerms: string[];
  setSearchTerms: (searchTerms: string[]) => void;
}

export const useStore = create<ForesightStore>((set) => ({
  history: undefined,
  setHistory: (history?: 3 | 7 | 30) => set({ history }),
  searchTerms: [],
  setSearchTerms: (searchTerms: string[]) => set({ searchTerms }),
}));
