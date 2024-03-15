"use client";

import { useOgma } from "@linkurious/ogma-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";

export interface LayoutServiceRef {
  refresh: () => void;
}

const LayoutService = forwardRef(
  (
    {
      // threats,
      fullScreen,
      dataLoaded,
      onExitFullScreen,
    }: {
      // threats: string[];
      dataLoaded: boolean;
      fullScreen: boolean;
      onExitFullScreen?: () => void;
    },
    ref,
  ) => {
    const ogma = useOgma();
    const timer = useRef<NodeJS.Timeout | null>(null);

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
          direction: "RL"
        })
        


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
    }, [ogma.events, ogma.geo, ogma.layouts]);

    // const updateLabelSize = useCallback(() => {
    //   ogma.events.once("idle", () => {
    //     if (!ogma.geo.enabled()) {
    //       const z = ogma.view.getZoom();
    //       const size = Math.min(Math.max(15, z * 8), 40);
    //       const cls =
    //         ogma.styles.getClass("textZoom") ??
    //         ogma.styles.createClass({
    //           name: "textZoom",
    //         });
    //       cls.update({
    //         nodeAttributes: {
    //           text: {
    //             size,
    //           },
    //         },
    //       });
    //     }
    //   });
    // }, [ogma.events, ogma.geo, ogma.styles, ogma.view]);

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
      ogma.events.on(
        [
          "addNodes",
          "removeNodes",
          // "transformationEnabled",
          // "transformationDisabled"
        ],
        onNodesAdded,
      );

      // const onZoom = () => {
      //   updateLabelSize();
      // };

      // ogma.events.on("viewChanged", onZoom);

      // cleanup
      return () => {
        ogma.events.off(onNodesAdded);
        // ogma.events.off(onZoom);
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
