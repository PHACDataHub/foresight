import { useEffect } from "react";

// import L from "leaflet";

import { type GeoClustering } from "@linkurious/ogma";
import { NeighborGeneration, useOgma } from "@linkurious/ogma-react";

import { useStore } from "~/app/_store";
import { getNodeData } from "~/app/_utils/graph";

export default function LocationTransforms() {
  const { geoMode, refresh } = useStore();
  const ogma = useOgma();

  useEffect(() => {
    const enableGeoMode = async () => {
      await ogma.geo.enable({
        longitudePath: "location.longitude",
        latitudePath: "location.latitude",
        minZoomLevel: 2,
        maxZoomLevel: 10,
        sizeRatio: 0.8,
      });
    //   const map = ogma.geo.getMap();
    //   L.gridLayer
    //     .googleMutant({
    //       type: "roadmap",
    //       styles: [
    //         { elementType: "labels", stylers: [{ visibility: "off" }] },
    //         { featureType: "water", stylers: [{ color: "#444444" }] },
    //       ],
    //     })
    //     .addTo(map);
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
          return Boolean(
            d?.type === "cluster" && d.locations && d.locations.length > 0,
          );
        }}
        neighborIdFunction={(n) => {
          const d = getNodeData(n);
          if (d?.type !== "cluster") return "UNKNOWN";
          return (
            d.locations
              ?.filter(
                (l) =>
                  typeof l.latitude === "number" &&
                  typeof l.longitude === "number",
              )
              .map((l) => JSON.stringify(l)) ?? []
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
