"use client";

import {
  type MouseButtonEvent,
  type NodeList,
  type RawNode,
} from "@linkurious/ogma";

import { useOgma } from "@linkurious/ogma-react";
import { useEffect } from "react";
import { useStore } from "~/app/_store";
import { createScale, getNodeData } from "~/app/_utils/graph";
import { type AllDataTypes } from "~/server/api/routers/post";
import { api } from "~/trpc/react";

const Interactions = () => {
  const {
    augmentScale,
    toggleExpandedCluster,
    expandedClusters,
    setLayout,
    setFocus,
  } = useStore();
  const ogma = useOgma();
  const cluster = api.post.cluster.useMutation();

  useEffect(() => {
    const doubleClickHandler = async ({
      target,
    }: MouseButtonEvent<unknown, unknown>) => {
      if (target && !target.isVirtual() && target.isNode) {
        const data = getNodeData(target);
        if (!data) return;
        if (data.type === "hierarchicalcluster" || data.type === "threat") {
          setFocus(target);
        } else if (data.type === "cluster") {
          if (expandedClusters.includes(data.id)) {
            toggleExpandedCluster(data.id);
            ogma.events.once("idle", async () => {
              void target.locate({ duration: 300, padding: 135 });
            });
          } else {
            toggleExpandedCluster(data.id);
            ogma.events.once("idle", async () => {
              setLayout("force");
              setFocus(null);
              let lNodes: NodeList<unknown, unknown> | null = null;
              const neigh = target
                .getAdjacentNodes()
                .filter((n) => n.getData("type") === "article");
              if (neigh.size === 0) {
                const articles = await cluster.mutateAsync({ id: data.id });
                augmentScale(
                  createScale({
                    nodes: ogma
                      .getNodes()
                      .map(
                        (n) =>
                          ({ data: getNodeData(n) }) as RawNode<AllDataTypes>,
                      )
                      .concat(articles.nodes),
                  }),
                );
                const g = await ogma.addGraph(articles);
                lNodes = g.nodes;
              }
              ogma.events.once("idle", async () => {
                await ogma.layouts.force({
                  gpu: true,
                  duration: 0,
                });
                await (lNodes ?? neigh).locate({ duration: 300, padding: 135 });
              });
            });
          }
        }
      }
    };
    ogma.events.on("doubleclick", doubleClickHandler);
    return () => {
      ogma.events.off(doubleClickHandler);
    };
  }, [
    augmentScale,
    cluster,
    expandedClusters,
    ogma,
    setFocus,
    setLayout,
    toggleExpandedCluster,
  ]);

  return <></>;
};

export default Interactions;
