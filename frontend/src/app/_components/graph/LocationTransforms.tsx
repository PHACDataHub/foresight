import { useEffect, useMemo } from "react";

// import L from "leaflet";

import { type GeoClustering } from "@linkurious/ogma";
import { NeighborGeneration, useOgma } from "@linkurious/ogma-react";

import L, { type Map } from "leaflet";
import { useStore } from "~/app/_store";
import { getNodeData, isLocationValid } from "~/app/_utils/graph";

type GoogleMutant = {
  googleMutant: (opts: { type: string }) => {
    addTo: (map: Map) => void;
    removeFrom: (map: Map) => void;
  };
};

export default function LocationTransforms() {
  const { geoMode, refresh, mapMode } = useStore();
  const ogma = useOgma();

  const tiles = useMemo(() => {
    const gm: GoogleMutant = L.gridLayer as unknown as GoogleMutant;
    return gm.googleMutant({
      type: mapMode,
    });
  }, [mapMode]);

  useEffect(() => {
    const ogmaUpdate = () => {
      if (mapMode === "open" || !geoMode) return;
      const map = ogma.geo.getMap();
      if (map) tiles.addTo(map);
    };
    if (ogma.geo.enabled()) ogmaUpdate();

    ogma.events.on("geoReady", ogmaUpdate);

    return () => {
      ogma.events.off(ogmaUpdate);
      const map = ogma.geo.getMap();
      if (map) tiles.removeFrom(map);
    };
  }, [geoMode, mapMode, ogma, tiles]);

  useEffect(() => {
    const enableGeoMode = async () => {
      await ogma.geo.enable({
        longitudePath: "location.longitude",
        latitudePath: "location.latitude",
        minZoomLevel: 2,
        maxZoomLevel: 10,
        sizeRatio: 0.8,
      });
    };
    const disableGeoMode = async (t: GeoClustering<unknown, unknown>) => {
      await t.disable();
      await t.destroy();
      await ogma.geo.disable();
      refresh();
    };
    if (geoMode) {
      void enableGeoMode();
      const t = ogma.transformations.addGeoClustering({
        enabled: true,
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
        void disableGeoMode(t);
      };
    }
  }, [geoMode, ogma, refresh]);

  return (
    <>
      <NeighborGeneration
        enabled={geoMode}
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
    </>
  );
}
