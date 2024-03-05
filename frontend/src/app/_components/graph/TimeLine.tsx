import { useOgma } from "@linkurious/ogma-react";
import { type MutableRefObject, useEffect, useRef } from "react";

// @ts-expect-error  No types are available for ogma-timeline-plugin
import { Controller } from "@linkurious/ogma-timeline-plugin";

import "@linkurious/ogma-timeline-plugin/style.css";
import type Ogma from "@linkurious/ogma";
import { type EdgeList, type NodeList } from "@linkurious/ogma";

type TimelinePluginConstructor = new (
  ogma: Ogma,
  container: HTMLElement,
  options: {
    minTime: number;
    maxTime: number;
  },
) => TimelinePluginInterface;

interface TimelinePluginInterface {
  refresh(opts: { nodes?: NodeList; edges?: EdgeList }): void;
}

const TimelinePlugin = Controller as TimelinePluginConstructor;

export default function TimeLine({
  container,
}: {
  container: MutableRefObject<HTMLElement | null>;
}) {
  const ogma = useOgma();

  const timeline = useRef<TimelinePluginInterface | null>(null);
  useEffect(() => {
    ogma.events.on("addNodes", () => {
      if (timeline.current === null) {
        if (container.current) {
            timeline.current = new TimelinePlugin(ogma, container.current, {
            minTime: new Date("2019-12-30").getTime(),
            maxTime: new Date("2020-01-02").getTime(),
            //   timeBars: [new Date("2019-12-01"), new Date("2020-01-31")],
            //   barchart: {
            //     nodeGroupIdFunction: (node) => node.getData("nodeType"),
            //   },
            //   timeline: {
            //     nodeGroupIdFunction: (node) => node.getData("nodeType"),
            //   },
          });
        }
      } else {
        timeline.current.refresh({ nodes: ogma.getNodes() });
      }
    });
  }, [container, ogma]);

  return <></>;
}
