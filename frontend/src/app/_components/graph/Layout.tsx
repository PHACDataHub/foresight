"use client";

import { type MouseButtonEvent } from "@linkurious/ogma";

import { NodeFilter, useOgma } from "@linkurious/ogma-react";
import { useCallback, useEffect, useMemo } from "react";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useStore } from "~/app/_store";
import { findAlongPath, getNodeData } from "~/app/_utils/graph";

export interface LayoutServiceRef {
  refresh: () => void;
}

export default function LayoutService({ hover }: { hover?: boolean }) {
  const ogma = useOgma();

  const {
    treeDirection,
    openNode,
    layout,
    setLayout,
    setOpenNode,
    everything,
    setSelectedNode,
    focus,
    selectedNode,
    refreshObserver,
    setFocus,
    toggleExpandedCluster,
    setLayoutBusy,
    setLayoutNotBusy,
    include_articles,
    history,
  } = useStore();

  const selectedPath = useMemo(() => {
    if (!selectedNode) return null;
    const data = getNodeData(selectedNode.node);
    if (data?.type === "hierarchicalcluster")
      return findAlongPath(selectedNode.node, "out", () => true);
    if (data?.type === "cluster" || data?.type === "threat")
      return findAlongPath(selectedNode.node, "in", () => true);
    return null;
  }, [selectedNode]);

  useEffect(() => {
    if (openNode) {
      const nodes = ogma
        .getNodes()
        .filter((n) => (n.getData() as { id: string }).id === openNode);
      nodes.setSelected(true);
      setSelectedNode({ node: nodes.get(0), activeTab: "summary", ogma });
      setOpenNode(undefined);
    }
  }, [openNode, ogma, setSelectedNode, setOpenNode]);

  const layoutGraph = useCallback(async () => {
    setLayoutBusy(layout);
    if (!ogma.geo.enabled() && !focus) {
      if (layout === "grid" && !hover) {
        await ogma.layouts.grid({
          locate: true,
          onSync: () => setLayoutNotBusy("grid"),
        });
      } else if ((hover ?? layout === "force") || everything) {
        await ogma.layouts.force({
          locate: true,
          gpu: true,
          // gravity: 0.1,
          // charge: 20,
          duration: hover ? 0 : undefined,
          onSync: () => setLayoutNotBusy("force"),
        });
        if (hover) {
          await ogma.view.locateGraph({ padding: 75 });
        }
      } else if (selectedNode?.node && layout === "radial") {
        await ogma.layouts.radial({
          centralNode: selectedNode.node,
          locate: true,
          onSync: () => {
            console.log("sync!");
            setLayoutNotBusy("radial");
          },
        });
      } else if (selectedNode?.node && layout === "concentric") {
        await ogma.layouts.concentric({
          centralNode: selectedNode.node,
          locate: true,
          onSync: () => setLayoutNotBusy("concentric"),
        });
      } else if (layout === "hierarchical" && !hover) {
        await ogma.layouts.hierarchical({
          locate: true,
          direction: treeDirection,
          onSync: () => setLayoutNotBusy("hierarchical"),
        });
      }
    }
  }, [
    setLayoutBusy,
    layout,
    focus,
    setLayoutNotBusy,
    hover,
    everything,
    selectedNode,
    ogma,
    treeDirection,
  ]);

  const updateLayout = useDebounceCallback(() => {
    void layoutGraph();
  }, [layoutGraph]);

  useEffect(() => {
    if (focus && selectedPath) {
      const related = selectedPath; // findAlongPath(focus, "out", () => true);
      const nodes = ogma
        .getNodes()
        .filter((n) => n === focus || related.includes(n));
      const viewSubGraph = async () => {
        await layoutGraph();
        const box = ogma.view.getGraphBoundingBox();
        const height = nodes.getBoundingBox();
        await nodes
          // .filter((n) => getNodeData(n)?.type !== "threat")
          .setAttribute("y", box.maxY + (height.maxY - height.minY));

        const clusters = nodes.filter(
          (n) => n === focus || getNodeData(n)?.type === "cluster",
        );

        const locateClusters = getNodeData(focus)?.type === "threat";

        await ogma.layouts.hierarchical({
          locate: !locateClusters,
          nodes,
          direction: treeDirection,
        });

        if (locateClusters) await clusters.locate();

        await ogma
          .getEdges()
          .filter(
            (e) =>
              !(
                selectedPath &&
                selectedPath.includes(e.getSource()) &&
                selectedPath.includes(e.getTarget())
              ) &&
              selectedPath &&
              (selectedPath.includes(e.getSource()) ||
                selectedPath.includes(e.getTarget())),
          )
          .setAttribute("opacity", 0.1);
      };
      void viewSubGraph();
    } else {
      void ogma.getEdges().setAttribute("opacity", 1);
    }
  }, [
    focus,
    layout,
    ogma,
    setLayout,
    selectedPath,
    layoutGraph,
    treeDirection,
  ]);

  useEffect(() => {
    if (!ogma.geo.enabled()) updateLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeDirection, layout, refreshObserver]);

  useEffect(() => {
    const clickHandler = ({ target }: MouseButtonEvent<unknown, unknown>) => {
      setSelectedNode(
        target &&
          (!target.isVirtual() ||
            (target.getData() as { location_generated?: boolean })
              ?.location_generated === true) &&
          target.isNode
          ? { node: target, activeTab: "summary", ogma }
          : null,
      );
      setFocus(null);
    };

    ogma.events.on("click", clickHandler);

    // cleanup
    return () => {
      ogma.events.off(clickHandler);
    };
  }, [
    ogma,
    setFocus,
    setLayout,
    setSelectedNode,
    toggleExpandedCluster,
    updateLayout,
  ]);

  return (
    <>
      {hover && <NodeFilter enabled criteria={(n) => !n.isVirtual()} />}

      {!include_articles && typeof history === "number" && (
        <NodeFilter
          enabled
          criteria={(n) => {
            return getNodeData(n)?.type !== "article";
          }}
        />
      )}
    </>
  );
}
