"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";

import {
  EdgeStyleRule,
  Geo,
  NodeFilter,
  NodeStyleRule,
  Ogma,
  Tooltip,
} from "@linkurious/ogma-react";
import OgmaLib, {
  type Edge,
  type Node as OgmaNode,
  type Point,
} from "@linkurious/ogma";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams } from "next/navigation";
import ThreatSelector from "~/app/_components/ThreatSelector";
import LayoutService from "./Layout";

import DataLoader, { type ForesightData } from "./DataLoader";
// import TimeLine from "./TimeLine";

OgmaLib.libraries.leaflet = L;

// Helper function to get the type of a Node
function getNodeType(node: OgmaNode): string {
  const data: ForesightData = node.getData() as ForesightData;
  if (data.type === "cluster") return "Cluster";
  if (data.type === "threat") return "Threat";
  return "unknown";
}

function getNodeTitle(node: OgmaNode): string {
  const data: ForesightData = node.getData() as ForesightData;
  return data.title;
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
  const { height, width } = useResizeObserver({ ref, box: "border-box" });
  const [tooltipPositon, setTooltipPosition] = useState<Point>({
    x: 0,
    y: 0,
  });
  const [target, setTarget] = useState<OgmaNode | Edge | null>();
  const { day } = useParams();

  const [threats, setThreats] = useState([
    "Outbreaks of known infectious diseases",
    "Emerging infectious diseases or novel pathogens",
    "Reports on suspicious disease-related incidents",
    "Foodborne illness outbreaks and recalls",
    "Waterborne diseases and contamination alerts",
    "Outbreaks linked to vaccine-preventable diseases",
    "Unusual health patterns",
    "Emerging pathogens",
    "Anomalous disease clusters",
  ]);

  // Controls
  const [geoMode, setGeoMode] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [maximized, setMaximized] = useState(false);

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

  useEffect(() => {
    if (!ogmaRef.current) return;
    if (maximized) {
      void ogmaRef.current.view.setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    } else if (width && height) {
      void ogmaRef.current.view.setSize({ width, height });
    }
  }, [height, width, maximized]);

  if (typeof day !== "string") return <p>Day error</p>;

  return (
    <div className="relative w-full flex-1" ref={ref}>
      <ThreatSelector selected={threats} onChange={setThreats} />
      <div className="absolute h-full max-h-full w-full max-w-full">
        <Ogma
          ref={ogmaRef}
          options={{
            // width,
            // height,
            detect: {
              edges: false,
              nodeTexts: false,
              edgeTexts: false,
            },
            interactions: {
              drag: {
                enabled: false,
              },
            },
          }}
          onReady={async (ogma) => {
            ogma.events
              // .on("click", ({ target }) => {
              //   if (target && target.isNode) {
              //     setClickedNode(target);
              //     setPopupOpen(true);
              //   }
              // })
              .on("mousemove", () => {
                const ptr = ogma.getPointerInformation();
                requestSetTooltipPosition(
                  ogma.view.screenToGraphCoordinates({ x: ptr.x, y: ptr.y }),
                );
                setTarget(ptr.target);
              })
              // locate graph when the nodes are added
              .on("addNodes", () =>
                ogma.view.locateGraph({ duration: 250, padding: 50 }),
              );
          }}
        >
          <DataLoader day={parseInt(day)} />
          <NodeFilter
            criteria={(node) => {
              const d = node.getData() as ForesightData;
              if (!d) return false;
              if (d.type === "threat") {
                return threats.includes(d.title);
              } else if (d.type === "cluster") {
                return (
                  node.getAdjacentNodes().filter((n) => {
                    const adjNode = n.getData() as ForesightData;
                    return (
                      adjNode.type === "cluster" ||
                      threats.includes(adjNode.title)
                    );
                  }).size > 0
                );
              }
              return true;
            }}
          />
          <NodeStyleRule
            attributes={{
              color: (n) =>
                getNodeType(n) === "Threat" ? "#997766" : "#668899",
              radius: (n) => 10 + n.getAdjacentNodes().size / 2,
              text: (n) => getNodeTitle(n),
              // pulse: (n) => ({
              //   enabled:
              //     getNodeType(n) === "Threat" && n.getAdjacentNodes().size > 60,
              //   endRatio: 1.2,
              //   width: 2,
              //   interval: 0,
              //   startRatio: 1.2,
              //   endColor: "red",
              //   startColor: "red",
              // }),
            }}
          />
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
            visible={false && !!target}
            placement="top"
            position={tooltipPositon}
          >
            <div className="x">
              {target &&
                target.isNode &&
                (getNodeType(target) === "Threat"
                  ? target.getData("neo4jProperties.text")
                  : target.getData("neo4jProperties.title"))}
              {target && !target.isNode && `Edge ${target.getId()}`}
            </div>
          </Tooltip>
          <LayoutService
            threats={threats}
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
              <button className="btn btn-primary" onClick={handleMaximizeClick}>
                <span className="wb-inv">Make Graph View Full Screen</span>
                <span
                  className={`glyphicon glyphicon-resize-${maximized ? "small" : "full"}`}
                />
              </button>
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
  );
}
