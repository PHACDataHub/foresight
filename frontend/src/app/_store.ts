import { create } from "zustand";
import {
  type Neo4JEdgeData,
  type Node as OgmaNode,
  type RawGraph,
} from "@linkurious/ogma";

import { type ScaleLinear } from "d3";
import { type AllDataTypes, type Cluster } from "~/server/api/routers/post";

export interface ForesightStore {
  articleCount: number;
  setArticleCount: (articleCount: number) => void;
  _loadArticleGraph: number;
  loadArticleGraph: (s?: boolean) => void;
  showInfoPanel: boolean;
  setShowInfoPanel: (showInfoPanel: boolean) => void;
  panelWasToggled: boolean;
  setPanelWasToggled: (panelWasToggled: boolean) => void;
  everything: boolean;
  setEverything: (everything: boolean) => void;
  refreshObserver: number;
  refresh: () => void;
  scale: Record<
    "cluster" | "hierarchicalcluster" | "threat" | "article" | "global",
    ScaleLinear<number, number> | null
  >;
  setScale: (
    scale: Record<
      "cluster" | "hierarchicalcluster" | "threat" | "article" | "global",
      ScaleLinear<number, number> | null
    >,
  ) => void;
  articleGraph: RawGraph<
    AllDataTypes,
    Neo4JEdgeData<Record<string, unknown>>
  > | null;
  setArticleGraph: (
    articleGraph: RawGraph<
      AllDataTypes,
      Neo4JEdgeData<Record<string, unknown>>
    > | null,
  ) => void;
  history?: 3 | 7 | 30;
  setHistory: (history?: 3 | 7 | 30) => void;
  focus: OgmaNode | null;
  setFocus: (focus: OgmaNode | null) => void;
  clusterId?: string;
  setClusterId: (clusterId?: string) => void;
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
  layout: "force" | "hierarchical";
  setLayout: (layout: "force" | "hierarchical") => void;
  geoMode: boolean;
  setGeoMode: (geoMode: boolean) => void;
  threats: string[];
  setThreats: (threats: string[]) => void;
  selectedNode: OgmaNode | null;
  setSelectedNode: (node: OgmaNode | null) => void;
  qa: Record<string, { question: string; answer?: string[] }[]>;
  addQA: (opts: {
    clusterId: string;
    question: string;
    answer?: string[];
  }) => void;
}

export const useStore = create<ForesightStore>((set) => ({
  articleCount: 0,
  setArticleCount: (articleCount: number) => set({ articleCount }),

  _loadArticleGraph: 0,
  loadArticleGraph: (s) =>
    set((state) => ({
      _loadArticleGraph: s ? state._loadArticleGraph + 1 : 0,
    })),
  showInfoPanel: false,
  setShowInfoPanel: (showInfoPanel) => set({ showInfoPanel }),
  panelWasToggled: false,
  setPanelWasToggled: (panelWasToggled) => set({ panelWasToggled }),
  everything: false,
  setEverything: (everything) => set({ everything }),
  refreshObserver: 0,
  refresh: () =>
    set((state) => ({ refreshObserver: state.refreshObserver + 1 })),
  scale: {
    global: null,
    cluster: null,
    hierarchicalcluster: null,
    threat: null,
    article: null,
  },
  articleGraph: null,
  setArticleGraph: (articleGraph) => set({ articleGraph }),
  setScale: (scale) => set({ scale }),
  focus: null,
  setFocus: (focus: OgmaNode | null) => set({ focus }),
  history: undefined,
  setHistory: (history?: 3 | 7 | 30) => set({ history }),
  clusterId: undefined,
  setClusterId: (clusterId) => set({ clusterId }),
  searchTerms: [],
  setSearchTerms: (searchTerms: string[]) => set({ searchTerms }),
  clusters: undefined,
  setClusters: (clusters) => set({ clusters }),
  locateNode: undefined,
  setLocateNode: (locateNode) => set({ locateNode }),
  treeDirection: "BT",
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
  layout: "hierarchical",
  setLayout: (layout) => set({ layout }),
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
  setSelectedNode: (selectedNode) =>
    set((state) => {
      if (!state.panelWasToggled && !state.showInfoPanel && selectedNode)
        return { selectedNode, showInfoPanel: true };
      return { selectedNode };
    }),
  openNode: undefined,
  setOpenNode: (openNode) => set({ openNode }),
  qa: {},
  addQA: ({ clusterId, question, answer }) =>
    set((state) => {
      const qa = { ...state.qa };
      qa[clusterId] = (qa[clusterId] ?? [])
        .filter((q) => q.question !== question)
        .concat({ question, answer });
      return { qa };
    }),
}));
