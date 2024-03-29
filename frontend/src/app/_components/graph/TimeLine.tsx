import { type NodeId } from "@linkurious/ogma";
import { useOgma } from "@linkurious/ogma-react";
import { type MutableRefObject, useEffect, useRef } from "react";

// @ts-expect-error  No types are available for ogma-timeline-plugin
import { Controller } from "@linkurious/ogma-timeline-plugin";

import "@linkurious/ogma-timeline-plugin/style.css";
import type Ogma from "@linkurious/ogma";
import { type EdgeList, type NodeList } from "@linkurious/ogma";
import { useParams } from "next/navigation";
import { useStore } from "~/app/_store";

type TimelinePluginConstructor = new (
  ogma: Ogma,
  container: HTMLElement,
  options: {
    minTime: number;
    maxTime: number;
    nodeStartPath: string;
    nodeEndPath: string;
    timeBars: (Date | { date: Date; fixed: boolean })[];
    nodeFilter: {
      enabled: boolean;
      strategy: "before" | "after" | "between" | "outside";
      tolerance: "strict" | "loose";
    };
  },
) => TimelinePluginInterface;

interface TimelinePluginInterface {
  setWindow(arg0: Date, arg1: Date): unknown;
  setTimebars(args: Date[]): void;
  on(
    arg0: string,
    arg1: (args: { nodes: NodeList; edges: EdgeList }) => void,
  ): unknown;
  refresh(opts: { nodes?: NodeList; edges?: EdgeList }): void;
  filteredNodes: { has: (id: NodeId) => boolean };
  setSelection(opts: { nodes?: NodeList; edges?: EdgeList }): void;
}

const TimelinePlugin = Controller as TimelinePluginConstructor;

export default function TimeLine({
  container,
}: {
  container: MutableRefObject<HTMLElement | null>;
}) {
  const ogma = useOgma();
  const { history } = useStore();
  const { day } = useParams();

  const timeline = useRef<TimelinePluginInterface | null>(null);
  useEffect(() => {
    ogma.events.once("idle", () => {
      if (timeline.current === null && history && typeof day === "string") {
        let isSelecting = false;
        if (container.current) {
          const d = parseInt(day);
          const baseDate = new Date(2019, 11, 1, 12);
          baseDate.setDate(baseDate.getDate() + d - 1);
          const endDate = new Date(baseDate);
          baseDate.setDate(baseDate.getDate() - history + 1);
          container.current.innerHTML = "";
          console.log(baseDate);
          console.log(endDate);
          timeline.current = new TimelinePlugin(ogma, container.current, {
            minTime: baseDate.getTime(),
            maxTime: endDate.getTime(),
            nodeStartPath: "pub_date",
            nodeEndPath: "some_null_value",
            // timeline: {
            //   nodeItemGenerator: node => {
            //     return {
            //       content: "test",
            //     }
            //   }
            // },
            timeBars: [baseDate, endDate],
            nodeFilter: {
              enabled: true,
              strategy: "before",
              tolerance: "loose",
            },

            // barchart: {
            //   graph2dOptions: {
            //     moment: function (date: Date) {
            //       return moment(date).utc();
            //     },
            //   },
            // },

            //   barchart: {
            //     nodeGroupIdFunction: (node) => node.getData("nodeType"),
            //   },
            //   timeline: {
            //     nodeGroupIdFunction: (node) => node.getData("nodeType"),
            //   },
          });
          timeline.current.setWindow(
            new Date(
              baseDate.getFullYear(),
              baseDate.getMonth(),
              baseDate.getDate() - 1,
              baseDate.getHours(),
            ),
            new Date(
              endDate.getFullYear(),
              endDate.getMonth(),
              endDate.getDate() + 1,
              endDate.getHours(),
            ),
          );

          const nodeFilter = ogma.transformations.addNodeFilter({
            criteria: (node) => {
              return timeline.current?.filteredNodes.has(node.getId()) ?? false;
            },
          });
          // const edgeFilter = ogma.transformations.addEdgeFilter({
          //   criteria: (edge) => {
          //     return timeline.current.filteredEdges.has(edge.getId());
          //   },
          // });

          //Hook it to the timeline events
          timeline.current.on("timechange", () => {
            void nodeFilter.refresh();
            // edgeFilter.refresh();
          });

          const animate = (day: number) => {
            const animationDay = new Date(
              baseDate.getFullYear(),
              baseDate.getMonth(),
              baseDate.getDate() + (day - 1),
              baseDate.getHours(),
            );
            const next =
              animationDay.getTime() >= endDate.getTime() ? 1 : day + 1;

            const executeAnimation = async () => {
              await nodeFilter.refresh();
              await ogma.layouts.force({
                locate: true,
                gpu: true,
                // gravity: 0.1,
                charge: 20,
              });
              animate(next);
            };

            setTimeout(() => {
              timeline.current?.setTimebars([animationDay]);
              timeline.current?.setWindow(
                new Date(
                  baseDate.getFullYear(),
                  baseDate.getMonth(),
                  baseDate.getDate() - 1,
                  baseDate.getHours(),
                ),
                new Date(
                  endDate.getFullYear(),
                  endDate.getMonth(),
                  endDate.getDate() + 1,
                  endDate.getHours(),
                ),
              );
              void executeAnimation();
            }, 200);
          };
          animate(1);

          timeline.current?.on("select", ({ nodes, edges }) => {
            isSelecting = true;
            ogma.getNodes().setSelected(false);
            ogma.getEdges().setSelected(false);

            if (nodes) {
              nodes.setSelected(true);
            }
            if (edges) {
              edges.setSelected(true);
            }
            isSelecting = false;
          });
          ogma.events.on(
            [
              "nodesSelected",
              "edgesSelected",
              "nodesUnselected",
              "edgesUnselected",
            ],
            () => {
              if (isSelecting) return;
              timeline.current?.setSelection({
                nodes: ogma.getSelectedNodes(),
                edges: ogma.getSelectedEdges(),
              });
            },
          );
        }
      }
    });

    const refresh = () => {
      if (timeline.current) console.log("refresh!");
      timeline.current?.refresh({
        nodes: ogma.getNodes(),
        edges: ogma.getEdges(),
      });
    };
    ogma.events.on(
      ["addNodes", "addEdges", "removeNodes", "removeEdges", "clearGraph"],
      refresh,
    );
    return () => {
      ogma.events.off(refresh);
    };
  }, [container, day, history, ogma]);

  return <></>;
}
