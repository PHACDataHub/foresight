import { create } from "zustand";
import { type Node as OgmaNode } from "@linkurious/ogma";

import { type Cluster } from "~/server/api/routers/post";

export interface ForesightStore {
  history?: 3 | 7 | 30;
  setHistory: (history?: 3 | 7 | 30) => void;
  searchTerms: string[];
  setSearchTerms: (searchTerms: string[]) => void;
  clusters?: Cluster[];
  setClusters: (clusters?: Cluster[]) => void;
  locateNode?: string;
  setLocateNode: (locateNode?: string) => void;
  // TODO: refactor open node madness
  openNode?: string;
  setOpenNode: (locateNode?: string) => void;
  treeDirection: "BT" | "TB" | "LR" | "RL";
  setTreeDirection: (treeDirection: "BT" | "TB" | "LR" | "RL") => void;
  toggleTreeDirection: () => void;
  geoMode: boolean;
  setGeoMode: (geoMode: boolean) => void;
  threats: string[];
  setThreats: (threats: string[]) => void;
  selectedNode: OgmaNode | null;
  setSelectedNode: (node: OgmaNode | null) => void;
}

export const useStore = create<ForesightStore>((set) => ({
  history: undefined,
  setHistory: (history?: 3 | 7 | 30) => set({ history }),
  searchTerms: [],
  setSearchTerms: (searchTerms: string[]) => set({ searchTerms }),
  clusters: undefined,
  setClusters: (clusters) => set({ clusters }),
  locateNode: undefined,
  setLocateNode: (locateNode) => set({ locateNode }),
  treeDirection: "RL",
  setTreeDirection: (treeDirection: "BT" | "TB" | "LR" | "RL") =>
    set({ treeDirection }),
  toggleTreeDirection: () => {
    set((state) => {
      if (state.treeDirection === "LR") return { treeDirection: "TB" };
      if (state.treeDirection === "TB") return { treeDirection: "RL" };
      if (state.treeDirection === "RL") return { treeDirection: "BT" };
      if (state.treeDirection === "BT") return { treeDirection: "LR" };
      return {};
    });
  },
  geoMode: false,
  setGeoMode: (geoMode: boolean) => set({ geoMode }),
  threats: [
    "Outbreaks of known infectious diseases",
    "Emerging infectious diseases or novel pathogens",
    "Reports on suspicious disease-related incidents",
    "Foodborne illness outbreaks and recalls",
    "Waterborne diseases and contamination alerts",
    "Outbreaks linked to vaccine-preventable diseases",
    "Unusual health patterns",
    "Emerging pathogens",
    "Anomalous disease clusters",
  ],
  setThreats: (threats) => set({ threats, selectedNode: null }),
  selectedNode: null,
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  openNode: undefined,
  setOpenNode: (openNode) => set({ openNode }),
}));
