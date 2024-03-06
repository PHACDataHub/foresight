"use client";

import { useOgma } from "@linkurious/ogma-react";
import { useCallback, useEffect } from "react";

export default function LayoutService({threats} : {threats: string[]}) {
  const ogma = useOgma();

  const updateLayout = useCallback(() => {
    ogma.events.once("idle", () => {
      if (!ogma.geo.enabled()) {
        void ogma.layouts.force({
          locate: true,
          gpu: true,
          // gravity: 0.1,
          charge: 20,
        });
      }
    });
  }, [ogma.events, ogma.geo, ogma.layouts]);

  useEffect(() => {
    // Update the layout if the threats change.
    // TODO: must be a better way
    updateLayout();
  }, [updateLayout, threats]);

  useEffect(() => {
    // register listener
    const onNodesAdded = () => {
      updateLayout();
    };

    ogma.events.on(
      [
        "addNodes",
        "removeNodes",
        "transformationEnabled",
        "transformationDisabled",
      ],
      onNodesAdded,
    );

    setTimeout(() => onNodesAdded(), 4000);

    // cleanup
    return () => {
      ogma.events.off(onNodesAdded);
    };
  }, [ogma, updateLayout]);

  return null;
}
