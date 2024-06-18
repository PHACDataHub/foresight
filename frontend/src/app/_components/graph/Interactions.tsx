"use client";

import { type MouseButtonEvent } from "@linkurious/ogma";

import { useOgma } from "@linkurious/ogma-react";
import { useEffect } from "react";
import { useStore } from "~/app/_store";
import { clusterExpandToggle, getNodeData } from "~/app/_utils/graph";
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
    persona,
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
          setFocus(null);
          clusterExpandToggle(
            target,
            ogma,
            expandedClusters,
            toggleExpandedCluster,
            async (id) => {
              return await cluster.mutateAsync({ id, persona });
            },
            setLayoutBusy,
            setLayoutNotBusy,
          );
        }
      }
    };
    ogma.events.on("doubleclick", doubleClickHandler);
    return () => {
      ogma.events.off(doubleClickHandler);
    };
  }, [
    persona,
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
