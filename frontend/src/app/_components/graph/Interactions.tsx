"use client";

import { type MouseButtonEvent, type NodeList } from "@linkurious/ogma";

import { useOgma } from "@linkurious/ogma-react";
import { useEffect } from "react";
import { useStore } from "~/app/_store";
import { getNodeData } from "~/app/_utils/graph";
import { api } from "~/trpc/react";

const Interactions = () => {
  const {
    augmentScale,
    toggleExpandedCluster,
    expandedClusters,
    setLayout,
    setFocus,
    setLayoutBusy,
    setLayoutNotBusy,
    refresh,
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
          } else {
            toggleExpandedCluster(data.id);
            ogma.events.once("idle", async () => {
              setFocus(null);
              let lNodes: NodeList<unknown, unknown> | null = null;
              const l = target
                .getAdjacentNodes()
                .filter((n) => n.getData("type") === "article");
              const neigh = ogma
                .getNodes()
                .filter((n) => n === target || l.includes(n));
              if (neigh.size <= 1) {
                const articles = await cluster.mutateAsync({ id: data.id });
                const g = await ogma.addGraph(articles);
                setLayoutBusy("force");
                lNodes = g.nodes.concat(target as unknown as NodeList);
              }
              await ogma.layouts.force({
                incremental: true,
                locate: true,
                margin: 40,
                nodes: lNodes ?? undefined,
                gpu: true,
                duration: 100,
                onSync: () => setLayoutNotBusy("force"),
              });
              ogma.events.once("idle", async () => {
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
    refresh,
    setLayout,
    setLayoutBusy,
    augmentScale,
    cluster,
    expandedClusters,
    ogma,
    setFocus,
    toggleExpandedCluster,
    setLayoutNotBusy,
  ]);

  return <></>;
};

export default Interactions;
