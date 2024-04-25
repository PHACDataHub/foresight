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

import { type Cluster } from "~/server/api/routers/post";
import Graph from "./graph";
import ClusterGrowth from "./ClusterGrowth";
import TimeLineBar from "./TimeLineBar";

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
    { day: parseInt(day as string), history, everything, threats },
    {
      refetchOnWindowFocus: false,
      enabled: typeof day === "string",
    },
  );

  const clusters = useMemo(() => {
    if (!rawGraph || isFetching) return [];
    return rawGraph.nodes
      .filter((n) => getRawNodeData(n)?.type === "cluster")
      .map((n) => getRawNodeData<Cluster>(n));
  }, [rawGraph, isFetching]);

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
        className={`flex ${showInfoPanel ? "border-r" : ""}`}
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
      <Panel className="flex flex-col " order={2}>
        <PanelGroup ref={panelDrawerRef} direction="vertical" id="drawer">
          <Panel className="flex flex-col " order={3}>
            {isFetching && (
              <div className="flex w-full flex-1 flex-col justify-center">
                <FontAwesomeIcon icon={faSpinner} size="4x" spin />
              </div>
            )}
            {!isFetching && rawGraph && (
              <Graph graph={rawGraph} ref={ogmaRef} />
            )}
          </Panel>

          {history && rawGraph && (
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
                {!drawerCollapsed &&
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
                  )}
              </Panel>
            </>
          )}
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}
