"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import {
  EdgeStyleRule,
  Geo,
  NodeStyleRule,
  Ogma,
  Tooltip,
} from "@linkurious/ogma-react";
import OgmaLib, {
  type Node as OgmaNode,
  type Point,
  type RawNode,
} from "@linkurious/ogma";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams } from "next/navigation";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useStore } from "~/app/_store";
import { type AllDataTypes } from "~/server/api/routers/post";
import LayoutService, { type LayoutServiceRef } from "./Layout";

import DataLoader, { type ForesightData } from "./DataLoader";
import NodeInfo from "./NodeInfo";
// import TimeLine from "./TimeLine";

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

// function nodeSearch(node: OgmaNode, terms: string[]) {
//   const data: ForesightData = node.getData() as ForesightData;
//   if (!data) return false;
//   for (const term of terms) {
//     if (
//       typeof data.title === "string" &&
//       data.title.toLowerCase().includes(term)
//     )
//       return true;
//     if (data.type === "cluster") {
//       if (
//         typeof data.summary === "string" &&
//         data.summary.toLowerCase().includes(term)
//       )
//         return true;
//     }
//   }
//   return false;
// }

// Helper function to get the type of a Node
function getNodeType(node: OgmaNode): string {
  const data: ForesightData = node.getData() as ForesightData;
  if (data.type === "cluster") return "Cluster";
  if (data.type === "threat") return "Threat";
  return "unknown";
}

// function getNodeFirstThreat(node: OgmaNode): string {
//   const edges = node.getAdjacentEdges();

//   for (let x = 0; x < edges.size; x += 1) {
//     const edge = edges.get(x);
//     if (getNodeType(edge.getSource()) === "Threat")
//       return getNodeTitle(edge.getSource());
//     if (getNodeType(edge.getTarget()) === "Threat")
//       return getNodeTitle(edge.getTarget());
//   }
//   return "NONE";
// }

// function getNodeTitle(node: OgmaNode): string {
//   const data: ForesightData = node.getData() as ForesightData;
//   return data.title;
// }

// function getClusterNodeData(node: OgmaNode) {
//   const data: ForesightData = node.getData() as ForesightData;
//   if (data.type === "cluster") return data;
//   return null;
// }

// function getNodeSummary(node: OgmaNode): string {
//   const data: ForesightData = node.getData() as ForesightData;
//   if (data.type === "cluster") return data.summary;
//   if (data.type === "threat") return data.title;
//   return "";
// }

export function getNodeData(node: OgmaNode) {
  const n = node as OgmaNode<AllDataTypes>;
  const data = n.getData();
  return data;
}

export function getRawNodeData(node: RawNode) {
  const n = node as RawNode<AllDataTypes>;
  const data = n.data;
  return data;
}

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function Graph() {
  // const [popupOpen, setPopupOpen] = useState(false);
  // const [clickedNode, setClickedNode] = useState<OgmaNode>();
  const ref = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const ogmaRef = useRef<OgmaLib | null>(null);
  const layoutService = useRef<LayoutServiceRef | null>(null);
  const { height, width } = useResizeObserver({ ref, box: "border-box" });
  const [tooltipPositon, setTooltipPosition] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [target, setTarget] = useState<OgmaNode | null>();
  const [selectedNode, setSelectedNode] = useState<OgmaNode | null>();
  const { day } = useParams();
  const [dataLoading, setDataLoading] = useState(false);

  // const [grouping, setGrouping] = useState(false);

  const { history } = useStore();

  const handleDataLoading = useCallback((loading: boolean) => {
    setDataLoading(loading);
  }, []);

  // const [threats, setThreats] = useState([
  //   "Outbreaks of known infectious diseases",
  //   "Emerging infectious diseases or novel pathogens",
  //   "Reports on suspicious disease-related incidents",
  //   "Foodborne illness outbreaks and recalls",
  //   "Waterborne diseases and contamination alerts",
  //   "Outbreaks linked to vaccine-preventable diseases",
  //   "Unusual health patterns",
  //   "Emerging pathogens",
  //   "Anomalous disease clusters",
  // ]);

  // Controls
  const [geoMode, setGeoMode] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // const toggleGrouping = useCallback(() => {
  //   setGrouping(!grouping);
  //   if (layoutService.current) {
  //     layoutService.current.refresh();
  //   }
  // }, [grouping]);

  const requestSetTooltipPosition = useCallback((pos: Point) => {
    requestAnimationFrame(() => setTooltipPosition(pos));
  }, []);

  const handleGeoBtnClick = useCallback(() => {
    setGeoMode(!geoMode);
  }, [geoMode]);

  const handleTimelineBtnClick = useCallback(() => {
    setShowTimeline(!showTimeline);
  }, [showTimeline]);

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
        void ogma.view.setSize({ width: w, height: h });
        void ogma.view.locateGraph();
      }
    },
  );

  useEffect(() => {
    if (!ogmaRef.current) return;
    if (maximized) {
      resizeOgma(ogmaRef.current, true, window.innerWidth, window.innerHeight);
    } else if (width && height) {
      resizeOgma(ogmaRef.current, false, width, height);
    }
  }, [height, width, maximized, resizeOgma]);

  // const nodeFilterCriteria = useCallback(
  //   (node: OgmaNode) => {
  //     const d = node.getData() as ForesightData;
  //     if (!d) return false;
  //     // return true;
  //     // return !grouping || d.type !== "threat";
  //     if (d.type === "threat") {
  //       return threats.includes(d.title) && node.getAdjacentNodes().size > 0;
  //     } else if (d.type === "cluster") {
  //       return (
  //         node.getAdjacentNodes().filter((n) => {
  //           const adjNode = n.getData() as ForesightData;
  //           return (
  //             adjNode.type === "cluster" || threats.includes(adjNode.title)
  //           );
  //         }).size > 0
  //       );
  //     }
  //     return false;
  //   },
  //   [threats],
  // );

  // const groupIdFunction = useCallback((n: OgmaNode) => {
  //   if (getNodeType(n) === "Threat") return getNodeTitle(n);
  //   return getNodeFirstThreat(n);
  // }, []);

  // const groupingNodeGenerator = useCallback(
  //   (nodes: NodeList, groupId: string) => {
  //     return {
  //       id: "special group " + groupId,
  //       data: {
  //         groupId: groupId,
  //       },
  //       attributes: {
  //         text: {
  //           content: groupId,
  //           color: "black",
  //           // opacity: 1,
  //         },
  //         color: hexToRgbA(colors(groupId), 0.32),
  //       },
  //     };
  //   },
  //   [],
  // );

  // const groupingOnCreated = useCallback(
  //   (
  //     metaNode: OgmaNode,
  //     visible: boolean,
  //     subNodes: NodeList,
  //     // subEdges: EdgeList,
  //   ) => {
  //     if (visible && ogmaRef.current) {
  //       void subNodes.setAttributes(
  //         OgmaLib.geometry.computeCentroid(subNodes.getAttributes(["x", "y"])),
  //       );
  //       return ogmaRef.current.layouts.force({
  //         nodes: subNodes,
  //         duration: 0,
  //         useWebWorker: false,
  //       });
  //     }
  //   },
  //   [],
  // );

  if (typeof day !== "string") return "Day error";

  return (
    <PanelGroup autoSaveId="example" direction="horizontal">
      <Panel defaultSize={50} className="flex flex-col border">
        <NodeInfo node={selectedNode} />
      </Panel>
      <PanelResizeHandle />
      <Panel className="flex border">
        <div className="relative w-full flex-1" ref={ref}>
          {/* <ThreatSelector selected={threats} onChange={setThreats} /> */}
          <div className="absolute h-full max-h-full w-full max-w-full">
            <Ogma
              key={`ogma-${day}-${history}`}
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
              onReady={async (ogma) => {
                ogma.events
                  .on("click", ({ target }) => {
                    setSelectedNode(target && target.isNode ? target : null);
                  })
                  .on("doubleclick", ({ target }) => {
                    if (target && target.isNode) {
                      void target.locate();
                    }
                  })
                  .on("mousemove", () => {
                    const ptr = ogma.getPointerInformation();
                    requestSetTooltipPosition(
                      ogma.view.screenToGraphCoordinates({
                        x: ptr.x,
                        y: ptr.y,
                      }),
                    );
                    if (
                      !ptr.target ||
                      (ptr.target.isNode &&
                        getNodeType(ptr.target) === "Cluster")
                    )
                      setTarget(ptr.target);
                  });
              }}
            >
              <DataLoader day={parseInt(day)} onLoading={handleDataLoading} />
              <NodeStyleRule
                attributes={{
                  text: {
                    scaling: true,
                    content: (n) => {
                      const data = getNodeData(n);
                      if (data.type === "hierarchicalcluster") return data.name;
                      if (data.type === "cluster") return data.title;
                      if (data.type === "threat") return data.title;
                    },
                  },
                  color: (n) => {
                    const data = getNodeData(n);
                    if (data.type === "hierarchicalcluster") return "#bacf99";
                    if (data.type === "cluster") return "#8297ec";
                    if (data.type === "threat") return "#ffb700";
                  },
                  radius: (n) => {
                    const data = getNodeData(n);
                    if (data.type === "hierarchicalcluster")
                      return data.clusters.length / 2;
                    if (data.type === "cluster") return data.nr_articles;
                    if (data.type === "threat") return data.score ?? 1;
                  },
                }}
              />
              {/* <NodeFilter enabled criteria={nodeFilterCriteria} /> */}
              {/* {!grouping && !dataLoading && <Hightlighter />} */}
              {false && !dataLoading && (
                <>
                  {/* <NodeGrouping
                    enabled={grouping}
                    // selector={n => getNodeType(n) === "Cluster"}
                    groupIdFunction={groupIdFunction}
                    nodeGenerator={groupingNodeGenerator}
                    showContents={() => true}
                    onCreated={groupingOnCreated}
                  />
                  <NodeStyleRule
                    attributes={{
                      text: {
                        scaling: true,
                      },
                      innerStroke: { width: 0.1, scalingMethod: "scaled" },
                      // opacity: n => getNodeType(n) === "Threat" ? 0 : 1,
                      color: (n) => {
                        if (n.getData("groupId")) {
                          return undefined;
                        }
                        if (getNodeType(n) === "Threat") return "#997766";
                        const threat = getNodeFirstThreat(n);
                        return colors(threat);
                      },
                      radius: (n) => {
                        if (n.getData("groupId")) return undefined;
                        const s = getClusterNodeData(n)?.node_size;
                        if (s) return s;
                        const adj: number[] = n
                          .getAdjacentNodes()
                          .getData("node_size")
                          .filter((o) => typeof o === "number")
                          .map((o) => o as number);
                        const sum = adj.reduce((p, c) => p + c, 0);
                        if (sum > 0) return sum / adj.length;
                        return 20;
                      },
                      halo: (n) => {
                        if (nodeSearch(n, searchTerms)) {
                          const s = getClusterNodeData(n)?.node_size;
                          const width = s ? s / 2 + 2 : 105;
                          return {
                            color: "yellow", // 'white',
                            width,
                            strokeColor: "#ccc",
                          };
                        }
                      },
                      // text: {
                      //   content: (n) => getNodeTitle(n),
                      //   size: 15,
                      // },
                      // pulse: (n) => ({
                      //   enabled: nodeSearch(n, searchTerms),
                      //   endRatio: 1.7,
                      //   width: 2,
                      //   interval: 0,
                      //   startRatio: 1.2,
                      //   endColor: "red",
                      //   startColor: "orange",
                      // }),
                    }}
                  /> */}
                </>
              )}

              <EdgeStyleRule
                attributes={{
                  shape: {
                    head: "arrow",
                  },
                  color: "#ccc",
                  width: 1,
                }}
              />

              {/* <Popup
          position={() => (clickedNode ? clickedNode.getPosition() : null)}
          onClose={() => setPopupOpen(false)}
          isOpen={clickedNode && popupOpen}
        >
          {clickedNode && (
            <div className="x">{`Node ${clickedNode.getId()}:`}</div>
          )}
        </Popup> */}
              <Tooltip
                visible={!!target && maximized}
                placement="top"
                position={tooltipPositon}
              >
                <div className="toolTip">
                  \ tool tip text
                  {/* {target?.isNode && getNodeSummary(target)} */}
                </div>
              </Tooltip>
              <LayoutService
                ref={layoutService}
                // threats={threats}
                dataLoaded={dataLoading}
                fullScreen={maximized}
                onExitFullScreen={handleMaximizeClick}
              />
              {/* <TimeLine container={timelineRef} /> */}
              <Geo
                enabled={geoMode}
                longitudePath="geo.longitude"
                latitudePath="geo.latitude"
                minZoomLevel={2}
                sizeRatio={0.8}
              />
              <>
                <div className="control-buttons space-y-2">
                  <button
                    className="btn btn-primary"
                    onClick={handleMaximizeClick}
                  >
                    <span className="wb-inv">Make Graph View Full Screen</span>
                    <span
                      className={`glyphicon glyphicon-resize-${maximized ? "small" : "full"}`}
                    />
                  </button>
                  {/* <button className="btn btn-primary" onClick={toggleGrouping}>
                    {grouping && "Ungroup"}
                    {!grouping && "Group"}
                  </button> */}

                  <button
                    className="btn btn-primary hidden"
                    onClick={handleGeoBtnClick}
                  >
                    Geo Mode
                  </button>
                  <button
                    className="btn btn-primary hidden"
                    onClick={handleTimelineBtnClick}
                  >
                    Timeline
                  </button>
                </div>
              </>
            </Ogma>
            <div
              id="timeline"
              ref={timelineRef}
              style={{
                opacity: showTimeline ? 1 : 0,
                pointerEvents: showTimeline ? "initial" : "none",
              }}
            />
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}
