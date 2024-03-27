"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import L from "leaflet";

import {
  type ImperativePanelGroupHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { NodeFilter, Ogma } from "@linkurious/ogma-react";
import OgmaLib from "@linkurious/ogma";

import {
  faArrowsRotate,
  faArrowsToDot,
  faArrowsToEye,
  faCircleNodes,
  faExpand,
  faGripLinesVertical,
  faGripVertical,
  faMap,
  faMinimize,
  faSitemap,
  faTrash,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import ButtonGroup from "@mui/material/ButtonGroup";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams } from "next/navigation";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useStore } from "~/app/_store";
import { getNodeData } from "~/app/_utils/graph";
import SidePanel from "~/app/_components/SidePanel";
import LayoutService, { type LayoutServiceRef } from "./Layout";

import DataLoader from "./DataLoader";
import TimeLine from "./TimeLine";
import LocationTransforms from "./LocationTransforms";

OgmaLib.libraries.leaflet = L;

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function Graph() {
  const ref = useRef<HTMLDivElement | null>(null);
  const ogmaParentContainer = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const ogmaRef = useRef<OgmaLib | null>(null);
  const ogmaHoverRef = useRef<OgmaLib | null>(null);
  const ogmaHoverContainerRef = useRef<HTMLDivElement | null>(null);
  const layoutService = useRef<LayoutServiceRef | null>(null);
  const panelRef = useRef<ImperativePanelGroupHandle>(null);

  const { height, width } = useResizeObserver({ ref, box: "border-box" });
  const { day } = useParams();
  const [dataLoading, setDataLoading] = useState(false);

  const {
    showInfoPanel,
    toggleTreeDirection,
    layout,
    setLayout,
    geoMode,
    setGeoMode,
    threats,
    clusterId,
    setFocus,
    refresh,
    setOgma,
    expandedClusters,
    setExpandedClusters,
    everything,
    setEverything,
    selectedNode,
  } = useStore();

  const MIN_SIZE_IN_PIXELS = 500;
  const COLLAPSED_SIZE_IN_PIXELS = 70;

  const [minSize, setMinSize] = useState(10);
  const [collpasedSize, setCollapsedSize] = useState(10);
  const [restoreLayout, setRestoreLayout] = useState<number[]>([]);

  // Convert left panel minimum size from pixels to %.
  useLayoutEffect(() => {
    const panelGroup = document.querySelector<HTMLDivElement>(
      '[data-panel-group-id="group"]',
    );
    const resizeHandles = document.querySelectorAll<HTMLDivElement>(
      "[data-panel-resize-handle-id]",
    );
    if (!panelGroup) return;
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
    return () => {
      observer.disconnect();
    };
  }, []);

  const handleDataLoading = useCallback((loading: boolean) => {
    setDataLoading(loading);
  }, []);

  const handleEverythingChange = useCallback(() => {
    setEverything(!everything);
  }, [everything, setEverything]);

  const handleReset = useCallback(() => {
    setFocus(null);
    refresh();
  }, [refresh, setFocus]);

  const handleLayoutClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, Event>) => {
      const l = e.currentTarget.getAttribute("data-layout");
      if (l === "hierarchical" && layout === l) toggleTreeDirection();
      if (
        l &&
        (l === "force" ||
          l === "hierarchical" ||
          l === "grid" ||
          l === "radial" ||
          l === "concentric")
      ) {
        setLayout(l);
        setFocus(null);
      }
    },
    [layout, setFocus, setLayout, toggleTreeDirection],
  );

  // Controls
  const [maximized, setMaximized] = useState(false);

  const handleGeoBtnClick = useCallback(() => {
    setGeoMode(!geoMode);
  }, [geoMode, setGeoMode]);

  const handleCollapseAllClick = useCallback(() => {
    setExpandedClusters([]);
    refresh();
  }, [refresh, setExpandedClusters]);

  const handleMaximizeClick = useCallback(() => {
    setMaximized(!maximized);
  }, [maximized]);

  const resizeOgma = useDebounceCallback(
    (ogma: OgmaLib, max: boolean, w: number, h: number) => {
      const currentSize = ogma.view.getSize();
      if (
        max &&
        (currentSize.height !== window.innerHeight ||
          currentSize.width !== window.innerWidth)
      ) {
        void ogma.view.setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      } else if (currentSize.width !== w || currentSize.height !== h) {
        const resize = async () => {
          await ogma.view.setSize({ width: w, height: h });
          if (ogma.geo.enabled()) {
            const view = ogma.geo.getView();
            await ogma.geo.disable({ duration: 0 });
            await ogma.geo.enable({ duration: 0 });
            if (view)
              await ogma.geo.setView(view.latitude, view.longitude, view.zoom);
          } else {
            await ogma.view.locateGraph();
          }
        };
        void resize();
      }
    },
  );

  useEffect(() => {
    if (ogmaRef.current && ogmaHoverContainerRef.current) {
      if (geoMode) {
        ogmaRef.current.geo
          .getMap()
          ?.getContainer()
          .appendChild(ogmaHoverContainerRef.current);
      } else {
        ogmaHoverContainerRef.current.classList.add("hidden");
        void ogmaHoverRef.current?.clearGraph();
        ogmaParentContainer.current?.appendChild(ogmaHoverContainerRef.current);
      }
    }
  }, [geoMode]);

  useEffect(() => {
    if (!ogmaRef.current) return;
    if (maximized) {
      resizeOgma(ogmaRef.current, true, window.innerWidth, window.innerHeight);
    } else if (width && height) {
      resizeOgma(ogmaRef.current, false, width, height);
    }
  }, [height, width, maximized, resizeOgma]);

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

  const layouts: [string, IconDefinition, boolean][] = useMemo(() => {
    return [
      ["force", faCircleNodes, true],
      ["hierarchical", faSitemap, !everything],
      ["grid", faGripVertical, true],
      ["radial", faArrowsToDot, Boolean(selectedNode?.node)],
      ["concentric", faArrowsToEye, Boolean(selectedNode?.node)],
    ];
  }, [everything, selectedNode]);

  if (typeof day !== "string") return "Day error";

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
        className="flex"
        style={{ transition: "flex 0.1s" }}
        order={1}
      >
        <SidePanel />
      </Panel>
      {showInfoPanel && (
        <PanelResizeHandle className="ml-2 mr-5 flex items-center">
          <FontAwesomeIcon icon={faGripLinesVertical} />
        </PanelResizeHandle>
      )}

      <Panel className="flex flex-col border" order={2}>
        <div className="relative w-full flex-1" ref={ref}>
          <div
            className="absolute h-full max-h-full w-full max-w-full"
            ref={ogmaParentContainer}
          >
            <Ogma
              // key={`ogma-${day}-${history}`}
              ref={ogmaRef}
              options={
                {
                  // width,
                  // height,
                  // detect: {
                  //   edges: false,
                  //   nodeTexts: false,
                  //   edgeTexts: false,
                  // },
                  // interactions: {
                  //   drag: {
                  //     enabled: false,
                  //   },
                  // },
                }
              }
              onReady={(ogma) => {
                setOgma(ogma);
                ogma.events
                  .on("mouseover", async ({ target }) => {
                    if (
                      !target ||
                      !target.isNode ||
                      !target.isVirtual() ||
                      !ogmaHoverContainerRef.current ||
                      !ogmaHoverRef.current
                    )
                      return;
                    const subNodes = target.getSubNodes()!;
                    if (subNodes?.size <= 1) {
                      ogmaHoverContainerRef.current?.classList.add("hidden");
                      return;
                    }
                    const subEdges = subNodes?.getAdjacentEdges({
                      filter: "all",
                      bothExtremities: true,
                    });
                    ogmaHoverContainerRef.current.classList.remove("hidden");
                    if (subNodes) {
                      const { x, y } = target.getPositionOnScreen();
                      ogmaHoverContainerRef.current.style.left = `${x + 50}px`;
                      ogmaHoverContainerRef.current.style.top = `${y}px`;
                      await ogmaHoverRef.current.setGraph({
                        nodes: subNodes.toJSON(),
                        edges: subEdges.toJSON(),
                      });
                      await ogmaHoverRef.current.layouts.force({
                        gpu: true,
                        locate: true,
                        duration: 0,
                      });
                    }
                  })
                  .on(["click", "dragStart", "viewChanged"], () => {
                    ogmaHoverContainerRef.current?.classList.add("hidden");
                  });
              }}
            >
              <DataLoader day={parseInt(day)} onLoading={handleDataLoading} />

              <NodeFilter
                enabled
                criteria={(n) => {
                  if (everything) return true;
                  const data = getNodeData(n);
                  if (data?.type === "article") {
                    const cluster_id = n.getData("cluster_id") as string;
                    if (expandedClusters.includes(cluster_id)) return true;
                    return false;
                  }
                  return true;
                }}
              />
              <LayoutService
                ref={layoutService}
                threats={threats}
                dataLoaded={dataLoading}
                fullScreen={maximized}
                onExitFullScreen={handleMaximizeClick}
              />
              {clusterId && <TimeLine container={timelineRef} />}
              <LocationTransforms />
              <>
                <div className="control-buttons">
                  <div className="flex space-x-2">
                    {!geoMode && (
                      <>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={everything}
                              onChange={handleEverythingChange}
                            />
                          }
                          label="Fetch All"
                        />

                        <IconButton
                          className="foresight-graph-btn"
                          title="Reset"
                          onClick={handleReset}
                        >
                          <FontAwesomeIcon
                            icon={faArrowsRotate}
                            color="inherit"
                          />
                        </IconButton>
                        <ButtonGroup>
                          {layouts.map(([l, icon, enabled]) => (
                            <IconButton
                              key={`layout${l}`}
                              className={`foresight-graph-btn${layout === l ? " active" : ""}${!enabled ? " disabled" : ""}`}
                              data-layout={l}
                              disabled={!enabled}
                              onClick={handleLayoutClick}
                              title={`Layout nodes using the ${l} algorithm`}
                            >
                              <FontAwesomeIcon icon={icon} color="inherit" />
                            </IconButton>
                          ))}
                        </ButtonGroup>
                      </>
                    )}
                    <IconButton
                      className="foresight-graph-btn"
                      onClick={handleGeoBtnClick}
                      title="View clusters on a map"
                    >
                      <FontAwesomeIcon icon={faMap} color="inherit" />
                    </IconButton>

                    <IconButton
                      className="foresight-graph-btn"
                      onClick={handleMaximizeClick}
                      title="Switch to Full Screen View"
                    >
                      <FontAwesomeIcon
                        color="inherit"
                        icon={maximized ? faMinimize : faExpand}
                      />
                    </IconButton>
                    <IconButton
                      className="foresight-graph-btn"
                      onClick={handleCollapseAllClick}
                      title="Remove articles"
                    >
                      <FontAwesomeIcon color="#da484a" icon={faTrash} />
                    </IconButton>
                  </div>
                </div>
              </>
            </Ogma>
            <div ref={ogmaHoverContainerRef} className="hoverogma hidden">
              <Ogma
                ref={ogmaHoverRef}
                options={{
                  width: 150,
                  height: 150,
                  backgroundColor: "rgba(250,250,250,0.75)",
                }}
              >
                <LayoutService
                  threats={threats}
                  dataLoaded={dataLoading}
                  fullScreen={false}
                  hover={true}
                />
              </Ogma>
            </div>
            {clusterId && (
              <div className="" id="timeline" ref={timelineRef}></div>
            )}
          </div>
        </div>
        {/* <div className="h-[256px]"></div> */}
      </Panel>
    </PanelGroup>
  );
}
