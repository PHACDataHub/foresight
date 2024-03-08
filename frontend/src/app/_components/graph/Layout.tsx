"use client";

import { useOgma } from "@linkurious/ogma-react";
import { useCallback, useEffect, useRef } from "react";

export default function LayoutService({
  threats,
  fullScreen,
  onExitFullScreen,
}: {
  threats: string[];
  fullScreen: boolean;
  onExitFullScreen?: () => void;
}) {
  const ogma = useOgma();
  const timer = useRef<NodeJS.Timeout | null>(null);

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

  const updateLabelSize = useCallback(() => {
    ogma.events.once("idle", () => {
      if (!ogma.geo.enabled()) {
        const z = ogma.view.getZoom();
        const size = Math.min(Math.max(15, z * 8), 40);
        const cls =
          ogma.styles.getClass("textZoom") ??
          ogma.styles.createClass({
            name: "textZoom",
          });
        cls.update({
          nodeAttributes: {
            text: {
              size,
            },
          },
        });
      }
    });
  }, [ogma.events, ogma.geo, ogma.styles, ogma.view]);

  useEffect(() => {
    const pollFullscreen = () => {
      timer.current = setTimeout(() => {
        if (!ogma.view.isFullScreen()) {
          if (onExitFullScreen) onExitFullScreen();
        } else pollFullscreen();
      }, 200);
    };
    ogma.events.once("idle", async () => {
      await ogma.view.setFullScreen(fullScreen);
      fullScreen && pollFullscreen();
    });
    if (!fullScreen) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fullScreen, ogma, onExitFullScreen]);

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

    const onZoom = () => {
      updateLabelSize();
    };

    ogma.events.on("viewChanged", onZoom);

    setTimeout(() => onNodesAdded(), 4000);

    // cleanup
    return () => {
      ogma.events.off(onNodesAdded);
      ogma.events.off(onZoom);
    };
  }, [ogma, updateLabelSize, updateLayout]);

  return null;
}
