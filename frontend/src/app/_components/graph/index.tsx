"use client";

// import L from "leaflet";
// import "leaflet.gridlayer.googlemutant";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

import { NodeGrouping, Ogma } from "@linkurious/ogma-react";
import OgmaLib, { type RawGraph } from "@linkurious/ogma";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams } from "next/navigation";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { type LayoutModes, useStore } from "~/app/_store";
import { applyLayout, getNodeData } from "~/app/_utils/graph";
import { env } from "~/env";
import LayoutService from "./Layout";

import Styles from "./Styles";
import Interactions from "./Interactions";
import Controls from "./Controls";
import LocationTransforms from "./LocationTransforms";
import ClusterTimeEvolution from "./ClusterTimeEvolution";

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

const Graph = forwardRef<
  OgmaLib,
  | { graph: RawGraph }
  | {
      graph: RawGraph;
      noControls?: true;
      layout: Exclude<LayoutModes, "concentric" | "radial" | "hierarchical">;
    }
>((props, ogmaRef) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const { graph } = props;
  const noControls = "noControls" in props ? props.noControls : false;
  const layout = "layout" in props ? props.layout : null;

  const [ogma, setOgma] = useState<OgmaLib | null>(null);

  const { height, width } = useResizeObserver({ ref, box: "content-box" });
  const { day } = useParams();

  const { clusterId, feature_Timeline } = useStore();

  const resizeOgma = useDebounceCallback(
    (ogma: OgmaLib, max: boolean, w: number, h: number) => {
      // OGMA bug: if there are no nodes, the canvas is not resized
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require("leaflet") as unknown;
    require("leaflet.gridlayer.googlemutant");
    OgmaLib.libraries.leaflet = L;

    const loadGoogleMaps = async () => {
      const loader = new Loader({
        apiKey: env.NEXT_PUBLIC_GOOGLE_API_KEY,
      });

      await loader.importLibrary("maps");
    };
    void loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (!ogma) return;
    if (ogma.view.isFullScreen()) {
      resizeOgma(ogma, true, window.innerWidth, window.innerHeight);
    } else if (width && height) {
      resizeOgma(ogma, false, width, height);
    }
  }, [height, width, resizeOgma, ogma]);

  useEffect(() => {
    if (ogma && noControls && layout) {
      setTimeout(() => {
        ogma.events.once("idle", () => {
          void applyLayout({ ogma, layout });
        });
      }, 0);
    }
  }, [layout, noControls, ogma, graph]);

  if (typeof day !== "string") return "Day error";

  return (
    <div className="relative w-full flex-1 overflow-hidden" ref={ref}>
      <Ogma
        graph={graph}
        ref={ogmaRef}
        onReady={(ogma) => setOgma(ogma)}
        options={{
          minimumHeight: 100,
          minimumWidth: 160,
        }}
      >
        <NodeGrouping
          enabled
          groupIdFunction={(n) => {
            const data = getNodeData(n);
            if (data?.type === "article")
              return n.getData("cluster_id") as string;
            if (data?.type === "cluster") return data.id;
          }}
          showContents={false}
          nodeGenerator={() => null}
        />
        <Styles />
        <Interactions />
        {!feature_Timeline && !noControls && <LayoutService />}
        {!feature_Timeline && !noControls && <Controls />}
        {!feature_Timeline && !noControls && <LocationTransforms />}
        {feature_Timeline && !noControls && <ClusterTimeEvolution />}
      </Ogma>
      {clusterId && <div className="" id="timeline" ref={timelineRef}></div>}
    </div>
  );
});
Graph.displayName = "Graph";
export default Graph;
