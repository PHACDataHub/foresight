"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type OgmaLib from "@linkurious/ogma";
import {
  type GeoClustering,
  type InputTarget,
} from "@linkurious/ogma";
import { NeighborGeneration, Ogma, useOgma } from "@linkurious/ogma-react";

import { type Map } from "leaflet";
import { useStore } from "~/app/_store";
import { getNodeData, isLocationValid } from "~/app/_utils/graph";
import Styles from "./Styles";
import LayoutService from "./Layout";

type GoogleMutant = {
  googleMutant: (opts: { type: string }) => {
    addTo: (map: Map) => void;
    removeFrom: (map: Map) => void;
  };
};

export default function LocationTransforms() {
  const { mapMode } = useStore();

  const ogmaHoverContainerRef = useRef<HTMLDivElement | null>(null);
  const ogmaHoverRef = useRef<OgmaLib | null>(null);

  const geoClustering = useRef<GeoClustering<unknown, unknown> | null>(null);
  const [enable, setEnable] = useState(false);

  const ogma = useOgma();

  const tiles = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require("leaflet") as { gridLayer: GoogleMutant };
    const gm = L.gridLayer;
    return gm.googleMutant({
      type: mapMode,
    });
  }, [mapMode]);

  /* Prepare geo clustering */
  useEffect(() => {
    geoClustering.current = ogma.transformations.addGeoClustering({
      enabled: false,
      radius: 100,
      nodeGenerator: (nodes) => {
        const n = nodes.get(0);
        const data = getNodeData(n);
        if (!data) return null;
        if (nodes.size === 1)
          return {
            data: {
              ...data,
            },
          };
        return {
          data: {
            ...data,
            location_generated: false,
          },
        };
      },
    });
    return () => {
      if (geoClustering.current) {
        void geoClustering.current.disable();
        void geoClustering.current.destroy();
      }
    };
  }, [ogma.transformations]);

  /* Activate geo clustering and neighbour generation */
  useEffect(() => {
    const handleGeoModeEnabled = () => {
      setEnable(true);
      void geoClustering.current?.enable();
    };
    const handleGeoModeDisabled = () => {
      setEnable(false);
      void geoClustering.current?.disable();
    };
    const handleGeoReady = () => {
      if (mapMode === "open") return;
      const map = ogma.geo.getMap();
      if (map) tiles.addTo(map);
    };

    ogma.events.on("geoReady", handleGeoReady);
    ogma.events.on("geoEnabled", handleGeoModeEnabled);
    ogma.events.on("geoDisabled", handleGeoModeDisabled);

    if (ogma.geo.enabled()) handleGeoReady();

    return () => {
      ogma.events.off(handleGeoModeEnabled);
      ogma.events.off(handleGeoModeDisabled);
      ogma.events.off(handleGeoReady);
      const map = ogma.geo.getMap();
      if (map) tiles.removeFrom(map);
    };
  }, [mapMode, ogma, tiles]);

  /* Bind events related to clustered hover action */
  useEffect(() => {
    const handleHideHover = () => {
      ogmaHoverContainerRef.current?.classList.add("hidden");
    };
    const handleMouseOver = async ({
      target,
    }: {
      target: InputTarget<unknown, unknown>;
    }) => {
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
          margin: 50,
          duration: 0,
        });
      }
    };
    ogma.events
      .on("mouseover", handleMouseOver)
      .on(["click", "dragStart", "viewChanged"], handleHideHover);
    return () => {
      ogma.events.off(handleMouseOver).off(handleHideHover);
    };
  }, [ogma.events]);

  return (
    <>
      <NeighborGeneration
        enabled={enable}
        selector={(n) => {
          const d = getNodeData(n);
          return (
            d?.type === "cluster" &&
            Boolean(
              d.locations && d.locations.filter(isLocationValid).length > 0,
            )
          );
        }}
        neighborIdFunction={(n) => {
          const d = getNodeData(n);
          if (d?.type !== "cluster") return "UNKNOWN";
          return (
            d.locations
              ?.filter((l) => isLocationValid(l))
              .map((l) => JSON.stringify({ ...l, id: d.id })) ?? []
          );
        }}
        nodeGenerator={(id, nodes) => {
          const n = nodes.get(0);
          if (!n) return {};
          return {
            data: {
              ...(n.getData() as object),
              location: JSON.parse(id) as object,
              location_generated: true,
            },
          };
        }}
      />
      <div ref={ogmaHoverContainerRef} className="hoverogma hidden">
        <Ogma
          ref={ogmaHoverRef}
          options={{
            width: 150,
            height: 150,
            backgroundColor: "rgba(250,250,250,0.75)",
          }}
        >
          <Styles />
          <LayoutService hover={true} />
        </Ogma>
      </div>
    </>
  );
}
