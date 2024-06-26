import { create } from "zustand";
import {
  type Neo4JEdgeData,
  type Node as OgmaNode,
  type RawGraph,
} from "@linkurious/ogma";
import type OgmaLib from "@linkurious/ogma";

import { type ScaleLinear } from "d3";
import { type AllDataTypes } from "~/server/api/routers/post";

const defaultThreats = [
  "Outbreaks of known infectious diseases",
  "Emerging infectious diseases or novel pathogens",
  "Reports on suspicious disease-related incidents",
  "Foodborne illness outbreaks and recalls",
  "Waterborne diseases and contamination alerts",
  "Outbreaks linked to vaccine-preventable diseases",
  "Unusual health patterns",
  "Emerging pathogens",
  "Anomalous disease clusters",
];

const defaultDfoThreats = [
  "Atlantic Salmon Farms and Expiring Leases",
  "Underwater Noise Pollution and its Impact on Marine Life",
  "Climate Change and Polar Bear Extinction Risk",
  "Atlantic Salmon Conservation in the Bay of Fundy",
  "Aquaculture and Wild Salmon Populations",
  "Biodiversity Loss and Climate Change Solutions in Canada",
  "Salt Marshes and Climate Change Impacts",
];

export type ClusterNodeSection = "summary" | "articles";
export type SelectedNode = {
  node: OgmaNode;
  activeTab: ClusterNodeSection;
  ogma: OgmaLib;
};

export type LayoutModes =
  | "force"
  | "hierarchical"
  | "grid"
  | "concentric"
  | "radial";

export interface ForesightStore {
  // Feature Flags
  feature_GroupArticleBy: boolean;
  setFeature_GroupArticleBy: (feature_GroupArticleBy: boolean) => void;
  feature_Timeline: boolean;
  setFeature_Timeline: (feature_Timeline: boolean) => void;
  feature_workbench: boolean;
  setFeature_Workbench: (feature_workbench: boolean) => void;

  persona: string;
  setPersona: (persona: string) => void;

  showTooltip: boolean;
  setShowTooltip: (showTooltip: boolean) => void;
  toggleShowTooltip: () => void;

  layoutBusy: LayoutModes[];
  setLayoutBusy: (layout: LayoutModes) => void;
  setLayoutNotBusy: (layout: LayoutModes) => void;

  mapMode: "open" | "roadmap" | "satellite" | "terrain" | "hybrid";
  setMapMode: (
    mapMode: "open" | "roadmap" | "satellite" | "terrain" | "hybrid",
  ) => void;

  clearSelections: () => void;

  rodMode: boolean;
  toggleRodMode: () => void;

  appError: string;
  registerError: (appError: string) => void;

  expandedClusters: string[];
  setExpandedClusters: (expandedClusters: string[]) => void;
  addExpandedCluster: (cluster: string) => void;
  removeExpandedCluster: (cluster: string) => void;
  toggleExpandedCluster: (cluster: string) => void;

  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
  qa: Record<string, { question: string; answer?: string[] }[]>;
  addQA: (opts: {
    clusterId: string;
    question: string;
    answer?: string[];
  }) => void;

  // Old things

  articleCount: number;
  setArticleCount: (articleCount: number) => void;
  showInfoPanel: boolean;
  setShowInfoPanel: (showInfoPanel: boolean) => void;
  showWorkbenchPanel: boolean;
  setShowWorkbenchPanel: (showInfoPanel: boolean) => void;
  panelWasToggled: boolean;
  setPanelWasToggled: (panelWasToggled: boolean) => void;
  include_articles: boolean;
  setIncludeArticles: (include_articles: boolean) => void;
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
  augmentScale: (
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
  searchAsYouType: string;
  setSearchAsYouType: (searchAsYouType: string) => void;
  searchTerms: string[];
  setSearchTerms: (searchTerms: string[]) => void;
  searchMatches: string[];
  setSearchMatches: (searchMatches: string[]) => void;
  searchAnd: boolean;
  setSearchAnd: (searchAnd: boolean) => void;
  keywordMatches: string[];
  setKeywordMatches: (searchMatches: string[]) => void;
  semanticSearch: string;
  setSemanticSearch: (semanticSearch: string) => void;
  semanticMatches: { id: number; score: number }[];
  setSemanticMatches: (
    semanticMatches: { id: number; score: number }[],
  ) => void;
  // TODO: refactor open node madness
  openNode?: string;
  setOpenNode: (locateNode?: string) => void;
  treeDirection: "BT" | "TB" | "LR" | "RL";
  setTreeDirection: (treeDirection: "BT" | "TB" | "LR" | "RL") => void;
  toggleTreeDirection: () => void;
  layout: LayoutModes;
  setLayout: (layout: LayoutModes) => void;
  threats: string[];
  setThreats: (threats: string[] | null) => void;
  sourceHighlight: string[];
  addSourceToHighlight: (source: string) => void;
  removeSourceToHighlight: (source: string) => void;
}

export const useStore = create<ForesightStore>((set) => ({
  persona: "alice",
  setPersona: (persona) =>
    set({
      persona,
      // threats: persona === "tom" ? defaultDfoThreats : defaultThreats,
    }),
  showTooltip: true,
  setShowTooltip: (showTooltip) => set({ showTooltip }),
  toggleShowTooltip: () =>
    set((state) => ({ showTooltip: !state.showTooltip })),

  layoutBusy: [],
  setLayoutBusy: (layout) =>
    set({
      layoutBusy: [layout],
    }),
  setLayoutNotBusy: (layout) =>
    set((state) => ({
      layoutBusy: state.layoutBusy.filter((s) => s !== layout),
    })),

  feature_GroupArticleBy: false,
  setFeature_GroupArticleBy: (feature_GroupArticleBy) =>
    set({ feature_GroupArticleBy }),

  feature_Timeline: false,
  setFeature_Timeline: (feature_Timeline) => set({ feature_Timeline }),

  feature_workbench: false,
  setFeature_Workbench: (feature_workbench) => set({ feature_workbench }),

  rodMode: false,
  mapMode: "roadmap",
  setMapMode: (mapMode) => set({ mapMode }),
  toggleRodMode: () => set((state) => ({ rodMode: !state.rodMode })),
  appError: "",
  registerError: (appError) => set({ appError }),
  expandedClusters: [],
  setExpandedClusters: (expandedClusters: string[]) =>
    set({ expandedClusters }),
  addExpandedCluster: (cluster: string) =>
    set((state) => {
      return {
        expandedClusters: state.expandedClusters.concat(cluster),
      };
    }),
  removeExpandedCluster: (cluster: string) =>
    set((state) => {
      return {
        expandedClusters: state.expandedClusters.filter((c) => c !== cluster),
      };
    }),
  toggleExpandedCluster: (cluster: string) =>
    set((state) => {
      if (state.expandedClusters.includes(cluster)) {
        return {
          expandedClusters: state.expandedClusters.filter((c) => c !== cluster),
        };
      } else {
        return {
          expandedClusters: state.expandedClusters.concat(cluster),
        };
      }
    }),

  clearSelections: () =>
    set({
      selectedNode: null,
      focus: null,
    }),

  articleCount: 0,
  setArticleCount: (articleCount: number) => set({ articleCount }),

  showInfoPanel: true,
  setShowInfoPanel: (showInfoPanel) => set({ showInfoPanel }),
  showWorkbenchPanel: false,
  setShowWorkbenchPanel: (showWorkbenchPanel) => set({ showWorkbenchPanel }),
  panelWasToggled: false,
  setPanelWasToggled: (panelWasToggled) => set({ panelWasToggled }),
  include_articles: false,
  setIncludeArticles: (include_articles) => set({ include_articles }),
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
  augmentScale: (scale) =>
    set((state) => {
      return {
        scale: {
          global: scale.global ?? state.scale.global,
          cluster: scale.cluster ?? state.scale.cluster,
          hierarchicalcluster:
            scale.hierarchicalcluster ?? state.scale.hierarchicalcluster,
          threat: scale.threat ?? state.scale.threat,
          article: scale.article ?? state.scale.article,
        },
      };
    }),
  focus: null,
  setFocus: (focus: OgmaNode | null) => set({ focus }),
  history: undefined,
  setHistory: (history?: 3 | 7 | 30) => set({ history }),
  clusterId: undefined,
  setClusterId: (clusterId) => set({ clusterId }),
  searchAsYouType: "",
  setSearchAsYouType: (searchAsYouType) => set({ searchAsYouType }),
  searchTerms: [],
  setSearchTerms: (searchTerms: string[]) => set({ searchTerms }),
  searchMatches: [],
  setSearchMatches: (searchMatches) => set({ searchMatches }),
  keywordMatches: [],
  setKeywordMatches: (keywordMatches) => set({ keywordMatches }),
  semanticSearch: "",
  setSemanticSearch: (semanticSearch) => set({ semanticSearch }),
  semanticMatches: [],
  setSemanticMatches: (semanticMatches) => set({ semanticMatches }),
  searchAnd: false,
  setSearchAnd: (searchAnd) => set({ searchAnd }),
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
  layout: "force",
  setLayout: (layout) => set({ layout }),
  threats: defaultThreats,
  setThreats: (threats) => {
    if (!threats) {
      set((state) => ({
        threats: state.persona === "tom" ? defaultDfoThreats : defaultThreats,
        selectedNode: null,
      }));
    } else set({ threats, selectedNode: null });
  },
  selectedNode: null,
  setSelectedNode: (selectedNode) =>
    set((state) => {
      if (!selectedNode?.node && state.selectedNode?.node) {
        state.selectedNode.node.setSelected(false);
      }
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
      const newValues: { question: string; answer?: string[] }[] = [
        { question, answer },
      ];
      qa[clusterId] = (qa[clusterId] ?? [])
        .filter((q) => q.question !== question)
        .concat(newValues);

      return { qa };
    }),
  sourceHighlight: [],
  addSourceToHighlight: (source) =>
    set((state) => ({
      sourceHighlight: state.sourceHighlight
        .filter((s) => s !== source)
        .concat(source),
    })),
  removeSourceToHighlight: (source) =>
    set((state) => ({
      sourceHighlight: state.sourceHighlight.filter((s) => s !== source),
    })),
}));
