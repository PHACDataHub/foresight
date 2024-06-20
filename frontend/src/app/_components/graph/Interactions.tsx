"use client";

import {
  type DragStartEvent,
  type GestureProgressEvent,
  type MouseButtonEvent,
} from "@linkurious/ogma";

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
    let orig_x: number[] = [];
    let orig_y: number[] = [];
    const dragStart = (ev: DragStartEvent<unknown, unknown>) => {
      if (!ev.target?.isNode || ev.target?.getData("type") !== "cluster")
        return;
      const { x, y } = ev.target.getPosition();
      orig_x = [x];
      orig_y = [y];
      ev.target
        ?.getAdjacentElements()
        .nodes.filter((n) => n.getData("type") === "article")
        .forEach((n) => {
          const { x, y } = n.getPosition();
          orig_x.push(x);
          orig_y.push(y);
        });
    };
    const dragProgress = async (ev: GestureProgressEvent<unknown, unknown>) => {
      const ox = orig_x[0];
      const oy = orig_y[0];
      if (
        typeof ox !== "number" ||
        typeof oy !== "number" ||
        !ev.target?.isNode
      )
        return;
      const { x, y } = ev.target.getPosition();
      const rel_x = x - ox;
      const rel_y = y - oy;
      const nodes = ev.target
        ?.getAdjacentElements()
        .nodes.filter((n) => n.getData("type") === "article");
      if (nodes)
        for (let i = 0; i < nodes?.size; i += 1) {
          const n = nodes.get(i);
          const onx = orig_x[i + 1] ?? 0;
          const ony = orig_y[i + 1] ?? 0;
          await n.setAttribute("x", onx + rel_x);
          await n.setAttribute("y", ony + rel_y);
        }
    };

    ogma.events.on("dragStart", dragStart);
    ogma.events.on("dragProgress", dragProgress);
    return () => {
      ogma.events.off(dragStart);
      ogma.events.off(dragProgress);
    };
  }, [ogma]);

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
              return await cluster.mutateAsync({ id: `${id}`, persona });
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
