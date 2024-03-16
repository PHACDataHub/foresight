"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import {
  EdgeStyleRule,
  Geo,
  NeighborGeneration,
  NodeFilter,
  NodeStyleRule,
  Ogma,
} from "@linkurious/ogma-react";
import OgmaLib, {
  type NodeList,
  type Node as OgmaNode,
  type RawNode,
} from "@linkurious/ogma";

import {
  faExpand,
  faMap,
  faMinimize,
  faRotate,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams } from "next/navigation";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useStore } from "~/app/_store";
import { type AllDataTypes } from "~/server/api/routers/post";
import ThreatSelector from "~/app/_components/ThreatSelector";
import LayoutService, { type LayoutServiceRef } from "./Layout";

import DataLoader from "./DataLoader";
import NodeInfo from "./NodeInfo";

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

export function getNodeData(node: OgmaNode): AllDataTypes | undefined {
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

export function findAlongPath(
  n: OgmaNode,
  direction: "in" | "out",
  comp: (node: OgmaNode) => boolean,
): NodeList {
  const nodes = n.getAdjacentNodes({ direction });
  let found = nodes.filter(comp);
  nodes.forEach(
    (ni) => (found = found.concat(findAlongPath(ni, direction, comp))),
  );
  return found;
}

export default function Graph() {
  const ref = useRef<HTMLDivElement | null>(null);
  const ogmaRef = useRef<OgmaLib | null>(null);
  const layoutService = useRef<LayoutServiceRef | null>(null);
  const { height, width } = useResizeObserver({ ref, box: "border-box" });
  const { day } = useParams();
  const [dataLoading, setDataLoading] = useState(false);

  const {
    searchTerms,
    toggleTreeDirection,
    geoMode,
    setGeoMode,
    threats,
    setSelectedNode,
  } = useStore();

  const handleDataLoading = useCallback((loading: boolean) => {
    setDataLoading(loading);
  }, []);

  // Controls
  const [maximized, setMaximized] = useState(false);

  const isNodeFiltered = (n: OgmaNode) => {
    const data = getNodeData(n);
    if (
      data?.type === "cluster" &&
      data.threats &&
      data.threats.filter((t) => threats.includes(t.title)).length === 0
    )
      return true;
    if (data?.type === "hierarchicalcluster") {
      const clusters = findAlongPath(
        n,
        "out",
        (a) => getNodeData(a)?.type === "cluster",
      )?.filter((a) => !isNodeFiltered(a));
      if (!clusters || clusters?.size === 0) return true;
    }
  };

  const isHaloed = useCallback(
    (n: OgmaNode) => {
      const data = getNodeData(n);
      if (data?.type === "cluster") {
        for (const term of searchTerms) {
          if (
            data.summary.toLowerCase().includes(term) ||
            data.title.toLowerCase().includes(term)
          )
            return true;
        }
      } else if (data?.type === "hierarchicalcluster") {
        const clusters = findAlongPath(
          n,
          "out",
          (node) => getNodeData(node)?.type === "cluster",
        ).filter((node) => isHaloed(node));
        if (clusters.size > 1) return true;
      }
      return false;
    },
    [searchTerms],
  );

  const handleGeoBtnClick = useCallback(() => {
    setGeoMode(!geoMode);
  }, [geoMode, setGeoMode]);

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

  if (typeof day !== "string") return "Day error";

  return (
    <PanelGroup autoSaveId="example" direction="horizontal">
      <Panel defaultSize={50} className="flex flex-col border">
        <NodeInfo />
      </Panel>
      <PanelResizeHandle />
      <Panel className="flex border">
        <div className="relative w-full flex-1" ref={ref}>
          <ThreatSelector />
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
              onReady={async (ogma) => {
                ogma.events
                  .on("click", ({ target }) => {
                    setSelectedNode(target && target.isNode ? target : null);
                  })
                  .on("doubleclick", ({ target }) => {
                    if (target && target.isNode) {
                      void target.locate();
                    }
                  });
              }}
            >
              <DataLoader day={parseInt(day)} onLoading={handleDataLoading} />
              <EdgeStyleRule
                attributes={{
                  shape: {
                    head: "arrow",
                  },
                  width: 1,
                  color: (e) => {
                    const dataSource = getNodeData(e.getSource());
                    const dataTarget = getNodeData(e.getTarget());
                    const types = [
                      "hierarchicalcluster",
                      "cluster",
                      "threat",
                      "article",
                    ];
                    if (
                      !types.includes(dataSource?.type ?? "") ||
                      !types.includes(dataTarget?.type ?? "")
                    )
                      return "#d9dae2";
                  },
                }}
              />
              <NodeStyleRule
                attributes={{
                  text: {
                    // scaling: true,
                    size: 15,
                    content: (n) => {
                      const data = getNodeData(n);
                      if (data?.type === "hierarchicalcluster")
                        return data.name;
                      if (data?.type === "cluster") return data.title;
                      if (data?.type === "threat") return data.title;
                    },
                  },
                  color: (n) => {
                    const data = getNodeData(n);
                    if (data?.type === "hierarchicalcluster") return "#bacf99";
                    if (data?.type === "cluster") return "#8297ec";
                    if (data?.type === "threat") return "#ffb700";
                    return "#d9dae2";
                  },
                  radius: (n) => {
                    const data = getNodeData(n);
                    if (data?.type === "hierarchicalcluster")
                      return data.clusters.length / 2;
                    if (data?.type === "cluster") return data.nr_articles;
                    if (data?.type === "threat")
                      return data.score ? data.score * 5 : 2.5;
                  },
                  halo: (n) => {
                    if (isHaloed(n))
                      return {
                        color: "yellow",
                        strokeColor: "#ccc",
                        width: 10,
                      };
                  },
                }}
              />
              <NodeFilter enabled criteria={(n) => !isNodeFiltered(n)} />
              <LayoutService
                ref={layoutService}
                threats={threats}
                dataLoaded={dataLoading}
                fullScreen={maximized}
                onExitFullScreen={handleMaximizeClick}
              />
              <NeighborGeneration
                enabled={geoMode}
                selector={(n) => getNodeData(n)?.type === "cluster"}
                neighborIdFunction={(n) => {
                  const data = getNodeData(n);
                  if (data?.type === "cluster") {
                    return data.locations
                      .filter(
                        (l) =>
                          typeof l.latitude === "number" &&
                          typeof l.longitude === "number",
                      )
                      .map((l) => JSON.stringify(l));
                  }
                  return null;
                }}
                nodeGenerator={(id, nodes) => {
                  const n = nodes.get(0);
                  if (!n) return {};
                  return {
                    data: {
                      ...(n.getData() as object),
                      location: JSON.parse(id) as object,
                    },
                  };
                }}
              />
              <Geo
                enabled={geoMode}
                longitudePath="location.longitude"
                latitudePath="location.latitude"
                minZoomLevel={2}
                sizeRatio={0.8}
              />
              <>
                <div className="control-buttons space-x-2">
                  <button
                    className="btn btn-primary"
                    onClick={handleGeoBtnClick}
                    title="Map view"
                  >
                    <span className="wb-inv">View clusters on a map</span>
                    <FontAwesomeIcon icon={faMap} />
                  </button>
                  <button
                    className={`btn btn-primary${geoMode ? " hidden" : ""}`}
                    onClick={toggleTreeDirection}
                    title="Rotate"
                  >
                    <span className="wb-inv">Rotate Tree View</span>
                    <FontAwesomeIcon icon={faRotate} />
                  </button>

                  <button
                    className="btn btn-primary"
                    onClick={handleMaximizeClick}
                    title="Fullscreen"
                  >
                    <span className="wb-inv">Switch to Full Screen View</span>
                    <FontAwesomeIcon icon={maximized ? faMinimize : faExpand} />
                  </button>
                </div>
              </>
            </Ogma>
          </div>
        </div>
      </Panel>
    </PanelGroup>
  );
}
