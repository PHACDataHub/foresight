"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type ImperativePanelGroupHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import type OgmaLib from "@linkurious/ogma";
import { type RawEdge, type RawNode } from "@linkurious/ogma";

import {
  faGripLines,
  faGripLinesVertical,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useParams } from "next/navigation";
import IconButton from "@mui/material/IconButton";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useStore } from "~/app/_store";
import SidePanel from "~/app/_components/SidePanel";
import { api } from "~/trpc/react";
import { getRawNodeData } from "~/app/_utils/graph";

import {
  type Article,
  type Cluster,
} from "~/server/api/routers/post";
import Graph from "./graph";
import ClusterGrowth from "./ClusterGrowth";
// import TimeLineBar from "./TimeLineBar";

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function PanelInterface() {
  const panelRef = useRef<ImperativePanelGroupHandle>(null);
  const panelDrawerRef = useRef<ImperativePanelGroupHandle>(null);
  const ogmaRef = useRef<OgmaLib>(null);
  // const canvasRef = useRef<HTMLCanvasElement>(null);

  const { day } = useParams();

  const {
    showInfoPanel,
    toggleRodMode,
    everything,
    threats,
    history,
    selectedNode,
    setSelectedNode,
    feature_Timeline,
    include_articles,
  } = useStore();

  const MIN_SIZE_IN_PIXELS = 500;
  const COLLAPSED_SIZE_IN_PIXELS = 70;

  const MIN_SIZE_IN_PIXELS_DRAWER = 155;
  const COLLAPSED_SIZE_IN_PIXELS_DRAWER = 20;

  const [minSize, setMinSize] = useState(10);
  const [collpasedSize, setCollapsedSize] = useState(10);

  const [drawerCollapsed, setDrawerCollapsed] = useState(false);
  const [minSizeDrawer, setMinSizeDrawer] = useState(10);
  const [collpasedSizeDrawer, setCollapsedSizeDrawer] = useState(10);

  const [restoreLayout, setRestoreLayout] = useState<number[]>([]);
  const [restoreDrawerLayout, setRestoreDrawerLayout] = useState<number[]>([]);

  const rodModeTracker = useRef<string>("");
  const rodModeTrackerTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSelectedNode(null);
  }, [day, setSelectedNode]);

  useEffect(() => {
    const rod = (e: KeyboardEvent) => {
      if (rodModeTrackerTimer.current)
        clearTimeout(rodModeTrackerTimer.current);
      rodModeTrackerTimer.current = setTimeout(() => {
        rodModeTracker.current = "";
      }, 500);
      rodModeTracker.current += e.key;
      if (rodModeTracker.current === "rodmode") toggleRodMode();
    };
    window.addEventListener("keyup", rod);
    return () => {
      window.removeEventListener("keyup", rod);
    };
  }, [toggleRodMode]);

  // Convert left panel minimum size from pixels to %.
  useLayoutEffect(() => {
    const panelGroup = document.querySelector<HTMLDivElement>(
      '[data-panel-group-id="group"]',
    );
    const panelGroupDrawer = document.querySelector<HTMLDivElement>(
      '[data-panel-group-id="drawer"]',
    );

    const resizeHandles =
      document.querySelectorAll<HTMLDivElement>("#group-handle");
    if (!panelGroup || !panelGroupDrawer) return;
    const observer = new ResizeObserver(() => {
      let width = panelGroup.offsetWidth;
      resizeHandles.forEach((resizeHandle) => {
        width -= resizeHandle.offsetWidth;
      });
      setMinSize((MIN_SIZE_IN_PIXELS / width) * 100);
      setCollapsedSize((COLLAPSED_SIZE_IN_PIXELS / width) * 100);
    });
    observer.observe(panelGroup);
    resizeHandles.forEach((resizeHandle) => {
      observer.observe(resizeHandle);
    });
    const resizeHandlesDrawer =
      document.querySelectorAll<HTMLDivElement>("#drawer-handle");
    const observerDrawer = new ResizeObserver(() => {
      let height = panelGroupDrawer.offsetHeight;
      resizeHandlesDrawer.forEach((resizeHandle) => {
        height -= resizeHandle.offsetHeight;
      });
      setMinSizeDrawer((MIN_SIZE_IN_PIXELS_DRAWER / height) * 100);
      setCollapsedSizeDrawer((COLLAPSED_SIZE_IN_PIXELS_DRAWER / height) * 100);
    });
    observerDrawer.observe(panelGroupDrawer);
    resizeHandlesDrawer.forEach((resizeHandle) => {
      observerDrawer.observe(resizeHandle);
    });

    return () => {
      observer.disconnect();
      observerDrawer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    if (!showInfoPanel) {
      setRestoreLayout(panelRef.current.getLayout());
      panelRef.current.setLayout([collpasedSize, 100 - collpasedSize]);
    }
  }, [collpasedSize, showInfoPanel]);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    if (showInfoPanel) {
      if (restoreLayout.length > 0) {
        setRestoreLayout([]);
        panelRef.current.setLayout(restoreLayout);
      }
    }
  }, [restoreLayout, showInfoPanel]);

  useLayoutEffect(() => {
    if (!panelDrawerRef.current) return;
    if (drawerCollapsed) {
      setRestoreDrawerLayout(panelDrawerRef.current.getLayout());
      panelDrawerRef.current.setLayout([
        100 - collpasedSizeDrawer,
        collpasedSizeDrawer,
      ]);
    }
  }, [collpasedSizeDrawer, drawerCollapsed]);

  useLayoutEffect(() => {
    if (!panelDrawerRef.current) return;
    if (!drawerCollapsed) {
      if (restoreDrawerLayout.length > 0) {
        setRestoreDrawerLayout([]);
        panelDrawerRef.current.setLayout(restoreDrawerLayout);
      }
    }
  }, [drawerCollapsed, restoreDrawerLayout]);

  const { isFetching, data: rawGraph } = api.post.hierarchicalClusters.useQuery(
    {
      day: parseInt(day as string),
      history,
      everything,
      threats,
      include_articles,
    },
    {
      refetchOnWindowFocus: false,
      enabled: typeof day === "string",
    },
  );

  const clusters = useMemo(() => {
    if (!rawGraph || isFetching) return [];
    return rawGraph.nodes
      .filter((n) => getRawNodeData(n)?.type === "cluster")
      .map((n) => getRawNodeData<Cluster>(n))
      .sort((a, b) => {
        if (a.nr_articles > b.nr_articles) return -1;
        if (a.nr_articles < b.nr_articles) return 1;
        return 0;
      });
  }, [rawGraph, isFetching]);

  const clusterEvolutionGraph = useMemo(() => {
    if (!feature_Timeline || !rawGraph || isFetching) return null;
    const filtered_out: string[] = [];
    const clusters = rawGraph.nodes
      .filter((n) => n.data?.type === "cluster")
      .sort((a, b) => {
        const ad = getRawNodeData<Cluster>(a);
        const bd = getRawNodeData<Cluster>(b);
        if (!ad || !bd) return 0;
        if (ad.nr_articles > bd.nr_articles) return -1;
        if (ad.nr_articles < bd.nr_articles) return 1;
        return 0;
      })
      .map((n) => n.id)
      .slice(0, 5);

    const all_articles = Object.fromEntries(
      rawGraph.nodes
        .filter((n) => {
          if (!n) return false;
          const d = getRawNodeData(n);
          if (d?.type !== "article") return false;
          return (
            rawGraph.edges.filter(
              (e) => e.source === n.id && clusters.includes(e.target),
            ).length > 0
          );
        })
        .map((n) => [`${n.id}`, n]),
    );

    const nodes = rawGraph.nodes.filter((n) => {
      const d = getRawNodeData(n);
      if (d?.type === "cluster" && clusters.includes(n.id)) return true;
      if (d?.type === "article" && n.id && all_articles[n.id]) return true;
      filtered_out.push(`${n.id}`);
      return false;
    });
    let edges = rawGraph.edges.filter(
      (e) =>
        !filtered_out.includes(`${e.source}`) &&
        !filtered_out.includes(`${e.target}`) &&
        (e.data as undefined | { neo4jType: string })?.neo4jType !==
          "SIMILAR_TO",
    );
    for (let x = nodes.length - 1; x >= 0; x -= 1) {
      const n = nodes[x];
      if (!n) continue;
      const data = getRawNodeData(n);
      if (data?.type === "cluster") {
        const articles = edges
          .filter((e) => e.target === n.id && all_articles[e.source])
          .map((e) => ({
            edge: e,
            node: all_articles[e.source] as RawNode<Article>,
          }));
        const dates = Array.from(
          new Set(
            articles.map((a) =>
              getRawNodeData<Article>(a.node).pub_date?.toDateString(),
            ),
          ),
        ).sort((a, b) => {
          if (typeof a !== "string" || typeof b !== "string") return 0;
          const t1 = new Date(a);
          const t2 = new Date(b);
          return t1.getTime() - t2.getTime();
        });
        const new_clusters = dates.map((d) => ({
          ...n,
          id: `${d}-${n.id}`,
          data: {
            ...n.data,
            cluster_date: d,
          },
        }));
        const new_articles = articles.reduce(
          (p, c) => {
            const d = getRawNodeData<Article>(c.node).pub_date;
            if (!d || !c.node.data) return p;
            for (let x = 0; x < dates.length - 1; x += 1) {
              if (d.getTime() < new Date(dates[x]!).getTime()) {
                p.push({
                  node: {
                    ...c.node,
                    id: `${d.toDateString()}-${c.node.id}`,
                    data: { ...c.node.data, cluster_date: d },
                  },
                  edge: c.edge,
                });
              }
            }
            return p;
          },
          [] as {
            node: RawNode<Article> & { data: { cluster_date: Date } };
            edge: RawEdge;
          }[],
        );

        nodes.splice(
          x,
          1,
          ...(new_clusters as RawNode[]),
          ...new_articles.map((a) => a.node),
        );
        edges = edges
          .filter((e) => !(e.source === n.id || e.target === n.id))
          .concat(
            articles.map((a) => {
              const d = getRawNodeData<Article>(
                a.node,
              ).pub_date?.toDateString();
              return {
                ...a.edge,
                id: `${a.edge.id}-${d}`,
                target: `${d}-${n.id}`,
              };
            }),
          )
          .concat(
            new_articles.map((a) => {
              const d = a.node.data.cluster_date.toDateString();
              return {
                ...a.edge,
                id: `${a.edge.id}--${d}`,
                source: `${a.node.id}`,
                target: `${d}-${n.id}`,
              };
            }),
          );
      }
    }
    return { nodes, edges };
  }, [feature_Timeline, rawGraph, isFetching]);

  const startDate = useMemo(() => {
    if (history && history <= 10 && typeof day === "string") {
      const d = parseInt(day);
      const baseDate = new Date(2019, 11, 1, 23);
      baseDate.setDate(baseDate.getDate() + d - 1);
      baseDate.setDate(baseDate.getDate() - history);
      return baseDate;
    }
    return null;
  }, [day, history]);

  const endDate = useMemo(() => {
    if (!startDate || !history) return null;
    const baseDate = new Date(startDate);
    baseDate.setDate(baseDate.getDate() + history);
    return baseDate;
  }, [history, startDate]);

  const clusterId = useMemo(() => {
    if (selectedNode?.node.getData("type") === "cluster") {
      return selectedNode.node.getData("id") as string;
    }
    if (selectedNode?.node.getData("type") === "article") {
      return selectedNode.node.getData("cluster_id") as string;
    }
    return null;
  }, [selectedNode?.node]);

  const handleDrawerCollapse = useCallback(() => {
    setDrawerCollapsed(!drawerCollapsed);
  }, [drawerCollapsed]);

  return (
    <PanelGroup
      ref={panelRef}
      autoSaveId="example"
      direction="horizontal"
      id="group"
    >
      <Panel
        defaultSize={25}
        minSize={showInfoPanel ? minSize : collpasedSize}
        className={`sdp-sidepanel flex ${showInfoPanel ? "border-r" : ""}`}
        style={{ transition: "flex 0.1s" }}
        order={1}
      >
        <SidePanel clusters={clusters} ogma={ogmaRef.current} />
      </Panel>
      {showInfoPanel && (
        <PanelResizeHandle
          className="ml-2 mr-5 flex items-center"
          id="group-handle"
        >
          <FontAwesomeIcon icon={faGripLinesVertical} />
        </PanelResizeHandle>
      )}
      <Panel className="flex flex-col " order={2} defaultSize={75}>
        <PanelGroup ref={panelDrawerRef} direction="vertical" id="drawer">
          <Panel
            className="sdp-graph-panel flex flex-col"
            order={3}
            defaultSize={100 - minSizeDrawer}
          >
            {isFetching && (
              <div className="flex w-full flex-1 flex-col justify-center">
                <FontAwesomeIcon icon={faSpinner} size="4x" spin />
              </div>
            )}
            {!isFetching && !feature_Timeline && rawGraph && (
              <Graph graph={rawGraph} ref={ogmaRef} />
            )}
            {feature_Timeline && clusterEvolutionGraph && (
              <Graph graph={clusterEvolutionGraph} ref={ogmaRef} />
            )}
          </Panel>

          {history && history < 10 && rawGraph && clusterId && (
            <>
              {!drawerCollapsed && (
                <PanelResizeHandle
                  id="drawer-handle"
                  className="mb-5 mt-2 flex justify-center"
                >
                  <FontAwesomeIcon icon={faGripLines} />
                  <IconButton
                    sx={{
                      position: "absolute",
                      right: 30,
                      "& *": { cursor: "pointer !important" },
                    }}
                    onClick={handleDrawerCollapse}
                  >
                    <ChevronDown size={22} />
                  </IconButton>
                </PanelResizeHandle>
              )}
              {drawerCollapsed && (
                <div className="flex justify-end">
                  <IconButton onClick={handleDrawerCollapse}>
                    <ChevronUp size={22} />
                  </IconButton>
                </div>
              )}
              <Panel
                className="flex flex-col"
                style={{
                  overflow: "auto",
                  transition: "flex 0.1s",
                }}
                order={4}
                defaultSize={minSizeDrawer}
                minSize={drawerCollapsed ? collpasedSizeDrawer : minSizeDrawer}
              >
                {!drawerCollapsed && clusterId && startDate && endDate && (
                  <ClusterGrowth
                    rawGraph={rawGraph}
                    clusterId={clusterId}
                    startDate={startDate}
                    endDate={endDate}
                  />
                )}
                {/* {!drawerCollapsed &&
                  !clusterId &&
                  ogmaRef.current &&
                  startDate &&
                  endDate && (
                    <TimeLineBar
                      ogma={ogmaRef.current}
                      rawGraph={rawGraph}
                      startDate={startDate}
                      endDate={endDate}
                    />
                  )} */}
              </Panel>
            </>
          )}
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
