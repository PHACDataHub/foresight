"use client";

import { useOgma } from "@linkurious/ogma-react";
import { useEffect } from "react";

export default function LayoutService() {
  const ogma = useOgma();

  useEffect(() => {
    // register listener
    const onNodesAdded = () => {
      ogma.events.once("idle", () => {
        if (!ogma.geo.enabled()) {
          void ogma.layouts.force({ locate: true, gpu: true });
        }
      });
    };

    ogma.events.on(
      ["addNodes", "transformationEnabled", "transformationDisabled"],
      onNodesAdded,
    );

    // cleanup
    return () => {
      ogma.events.off(onNodesAdded);
    };
  }, [ogma]);

  return null;
}
