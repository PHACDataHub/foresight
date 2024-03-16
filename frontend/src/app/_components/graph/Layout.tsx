"use client";

import { useOgma } from "@linkurious/ogma-react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useStore } from "~/app/_store";

export interface LayoutServiceRef {
  refresh: () => void;
}

const LayoutService = forwardRef(
  (
    {
      threats,
      fullScreen,
      dataLoaded,
      onExitFullScreen,
    }: {
      threats: string[];
      dataLoaded: boolean;
      fullScreen: boolean;
      onExitFullScreen?: () => void;
    },
    ref,
  ) => {
    const ogma = useOgma();
    const timer = useRef<NodeJS.Timeout | null>(null);

    const { locateNode, treeDirection, geoMode, openNode, setSelectedNode } = useStore();

    useEffect(() => {
      if (locateNode) {
        const nodes = ogma
          .getNodes()
          .filter((n) => (n.getData() as { id: string }).id === locateNode);
        void nodes.locate();
        void nodes.pulse();
      }
    }, [locateNode, ogma]);

    useEffect(() => {
      if (openNode) {
        const nodes = ogma
          .getNodes()
          .filter((n) => (n.getData() as { id: string }).id === openNode);
          setSelectedNode(nodes.get(0));
      }
    }, [openNode, ogma, setSelectedNode]);

    const updateLayout = useDebounceCallback(() => {
      // ogma.events.once("idle", () => {
      if (!ogma.geo.enabled()) {
        // void ogma.layouts.force({
        //   locate: true,
        //   gpu: true,
        //   // gravity: 0.1,
        //   charge: 20,
        // });

        void ogma.layouts.hierarchical({
          locate: true,
          direction: treeDirection,
        });

        // void ogma.layouts.force({
        //   locate: true,
        //   gpu: true,

        //   // steps: 150,
        //   // charge: 0.125,
        //   // gravity: 0.01,
        //   // edgeStrength: 1,
        //   // theta: 0.9,
        // });
      } 
      // });
    }, [ogma.events, ogma.geo, ogma.layouts, treeDirection]);

    useEffect(() => {
      updateLayout();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeDirection, threats, geoMode]);

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
      dataLoaded && updateLayout();
    }, [dataLoaded, updateLayout]);

    useEffect(() => {
      // register listener
      const onNodesAdded = () => {
        updateLayout();
      };
      ogma.events.on(["addNodes", "removeNodes"], onNodesAdded);

      // cleanup
      return () => {
        ogma.events.off(onNodesAdded);
      };
    }, [ogma, ref, updateLayout]);

    useImperativeHandle(ref, () => ({
      refresh: updateLayout,
    }));
    return null;
  },
);
LayoutService.displayName = "LayoutService";
export default LayoutService;
