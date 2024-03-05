"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";

import {
  EdgeStyleRule,
  Geo,
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
import LayoutService from "./Layout";

import DataLoader from "./DataLoader";
import TimeLine from "./TimeLine";

OgmaLib.libraries.leaflet = L;

// Helper function to get the type of a Node
function getNodeType(node: OgmaNode): string {
  const labels = node.getData("neo4jLabels") as string[];
  return labels[0] ?? "unknown";
}

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function Graph({ countries }: { countries: Country[] }) {
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

  // Controls

  const [geoMode, setGeoMode] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  const requestSetTooltipPosition = useCallback((pos: Point) => {
    requestAnimationFrame(() => setTooltipPosition(pos));
  }, []);

  const handleGeoBtnClick = useCallback(() => {
    setGeoMode(!geoMode);
  }, [geoMode]);

  const handleTimelineBtnClick = useCallback(() => {
    setShowTimeline(!showTimeline);
  }, [showTimeline]);

  useEffect(() => {
    if (ogmaRef.current && width && height) {
      void ogmaRef.current.view.setSize({ width, height });
    }
  }, [height, width]);

  return (
    <div className="relative w-full flex-1" ref={ref}>
      <div className="absolute h-full max-h-full w-full  max-w-full">
        <Ogma
          ref={ogmaRef}
          options={{
            width,
            height,
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
          <DataLoader countries={countries} />
          <NodeStyleRule
            attributes={{
              color: (n) =>
                getNodeType(n) === "Topic" ? "#76378A" : "#9AD0D0",
              radius: (n) => 10 + n.getAdjacentNodes().size / 10,
              text: (n) => getNodeType(n),
              // pulse: (n) => ({
              //   enabled:
              //     getNodeType(n) === "Topic" && n.getAdjacentNodes().size > 500,
              //   endRatio: 1.5,
              //   width: 4,
              //   interval: 600,
              //   startRatio: 1.0,
              //   endColor: "red",
              //   startColor: "orange",
              // }),
            }}
          />
          <EdgeStyleRule
            attributes={{
              shape: {
                head: "arrow",
              },
              // color: "#444",
              width: 3,
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
          <Tooltip visible={!!target} placement="top" position={tooltipPositon}>
            <div className="x">
              {target &&
                target.isNode &&
                (getNodeType(target) === "Topic"
                  ? target.getData("neo4jProperties.text")
                  : target.getData("neo4jProperties.title"))}
              {target && !target.isNode && `Edge ${target.getId()}`}
            </div>
          </Tooltip>
          <LayoutService />
          <TimeLine container={timelineRef} />
          <Geo
            enabled={geoMode}
            longitudePath="geo.longitude"
            latitudePath="geo.latitude"
            minZoomLevel={2}
            sizeRatio={0.8}
          />
          <>
            <div className="control-buttons space-y-2">
              <button className="btn btn-primary" onClick={handleGeoBtnClick}>
                Geo Mode
              </button>
              <button
                className="btn btn-primary"
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
