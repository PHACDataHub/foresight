"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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

import { Geo, NodeFilter, Ogma } from "@linkurious/ogma-react";
import OgmaLib from "@linkurious/ogma";

import {
  faArrowsRotate,
  faCircleNodes,
  faExpand,
  faMap,
  faMinimize,
  faSitemap,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams } from "next/navigation";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useStore } from "~/app/_store";
import { getNodeData } from "~/app/_utils/graph";
import LayoutService, { type LayoutServiceRef } from "./Layout";

import DataLoader from "./DataLoader";
import NodeInfo from "./NodeInfo";
import TimeLine from "./TimeLine";

// const colors = d3.scaleOrdinal(d3.schemeCategory10);

OgmaLib.libraries.leaflet = L;

// function hexToRgbA(hex: string, opacity = 1) {
//   let c: string[] | string;
//   if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
//     c = hex.substring(1).split("");
//     if (c.length == 3) {
//       c = [
//         c[0] ?? "0",
//         c[0] ?? "0",
//         c[1] ?? "0",
//         c[1] ?? "0",
//         c[2] ?? "0",
//         c[2] ?? "0",
//       ];
//     }
//     const h = Number("0x" + c.join(""));

//     return (
//       "rgba(" +
//       [(h >> 16) & 255, (h >> 8) & 255, h & 255].join(",") +
//       `,${opacity})`
//     );
//   }
//   throw new Error("Bad Hex");
// }

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function Graph() {
  const ref = useRef<HTMLDivElement | null>(null);
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
  } = useStore();

  const MIN_SIZE_IN_PIXELS = 300;
  const COLLAPSED_SIZE_IN_PIXELS = 50;

  const [minSize, setMinSize] = useState(10);
  const [collpasedSize, setCollapsedSize] = useState(10);
  const [restoreLayout, setRestoreLayout] = useState<number[]>([]);

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

      // Minimum size in pixels is a percentage of the PanelGroup's width,
      // less the (fixed) width of the resize handles.
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

  const handleReset = useCallback(() => {
    setFocus(null);
    refresh();
  }, [refresh, setFocus]);

  const handleLayoutForceClick = useCallback(() => {
    setLayout("force");
    setFocus(null);
  }, [setFocus, setLayout]);

  const handleLayoutHierarchicalClick = useCallback(() => {
    if (layout === "hierarchical") toggleTreeDirection();
    setLayout("hierarchical");
    setFocus(null);
  }, [layout, setFocus, setLayout, toggleTreeDirection]);

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
      ogmaRef.current.geo
        .getMap()
        ?.getContainer()
        .appendChild(ogmaHoverContainerRef.current);
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
        className={`flex ${showInfoPanel ? "border" : ""}`}
        order={1}
      >
        <NodeInfo />
      </Panel>
      <PanelResizeHandle />

      <Panel className="flex flex-col border" order={2}>
        <div className="relative w-full flex-1" ref={ref}>
          <div className="absolute h-full max-h-full w-full max-w-full">
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
              <Geo
                enabled={geoMode}
                longitudePath="location.longitude"
                latitudePath="location.latitude"
                minZoomLevel={2}
                maxZoomLevel={10}
                sizeRatio={0.8}
                duration={0}
              />
              <>
                <div className="control-buttons">
                  <div className="flex space-x-2">
                    {!geoMode && (
                      <>
                        <button
                          className="btn btn-primary"
                          title="Reset"
                          onClick={handleReset}
                        >
                          <FontAwesomeIcon icon={faArrowsRotate} />
                        </button>
                        <div className="btn-group">
                          <button
                            className={`btn btn-primary${layout === "hierarchical" ? " active" : ""}`}
                            onClick={handleLayoutHierarchicalClick}
                            title="Hierarchical Layout"
                          >
                            <span className="wb-inv">
                              Layout nodes using a hierarchical algorithm
                            </span>
                            <FontAwesomeIcon icon={faSitemap} />
                          </button>
                          <button
                            className={`btn btn-primary${layout === "force" ? " active" : ""}`}
                            onClick={handleLayoutForceClick}
                            title="Force Layout"
                          >
                            <span className="wb-inv">
                              Layout nodes using a force layout
                            </span>
                            <FontAwesomeIcon icon={faCircleNodes} />
                          </button>
                        </div>
                      </>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={handleGeoBtnClick}
                      title="Map view"
                    >
                      <span className="wb-inv">View clusters on a map</span>
                      <FontAwesomeIcon icon={faMap} />
                    </button>

                    <button
                      className="btn btn-primary"
                      onClick={handleMaximizeClick}
                      title="Fullscreen"
                    >
                      <span className="wb-inv">Switch to Full Screen View</span>
                      <FontAwesomeIcon
                        icon={maximized ? faMinimize : faExpand}
                      />
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleCollapseAllClick}
                      title="Remove articles and threats"
                    >
                      <FontAwesomeIcon color="#da484a" icon={faTrash} />
                    </button>
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
