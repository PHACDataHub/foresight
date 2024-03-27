"use client";

import {
  type Edge,
  type MouseButtonEvent,
  type Node as OgmaNode,
} from "@linkurious/ogma";

import {
  EdgeStyleRule,
  NodeFilter,
  NodeStyleRule,
  useOgma,
} from "@linkurious/ogma-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { useSearchTerms } from "~/app/_hooks/useSearchTerms";
import { useStore } from "~/app/_store";
import {
  findAlongPath,
  getNodeColor,
  getNodeData,
  getNodeRadius,
} from "~/app/_utils/graph";

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
      hover,
    }: {
      threats: string[];
      dataLoaded: boolean;
      fullScreen: boolean;
      hover?: boolean;
      onExitFullScreen?: () => void;
    },
    ref,
  ) => {
    const ogma = useOgma();
    const timer = useRef<NodeJS.Timeout | null>(null);

    const {
      treeDirection,
      geoMode,
      openNode,
      layout,
      setLayout,
      setOpenNode,
      everything,
      setSelectedNode,
      focus,
      selectedNode,
      scale,
      refreshObserver,
      setFocus,
      toggleExpandedCluster,
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

    const edgeOnSelectedPath = useCallback(
      (e: Edge) => {
        const dataTarget = e.getTarget();
        const dataSource = e.getSource();
        return (
          selectedPath &&
          ((selectedNode?.node === dataTarget &&
            selectedPath.includes(dataSource)) ||
            (selectedNode?.node === dataSource &&
              selectedPath.includes(dataTarget)) ||
            (selectedPath.includes(dataSource) &&
              selectedPath.includes(dataTarget)))
        );
      },
      [selectedNode, selectedPath],
    );

    useEffect(() => {
      if (openNode) {
        const nodes = ogma
          .getNodes()
          .filter((n) => (n.getData() as { id: string }).id === openNode);
        nodes.setSelected(true);
        setSelectedNode({ node: nodes.get(0), expand: ["summary", "qa"] });
        setOpenNode(undefined);
      }
    }, [openNode, ogma, setSelectedNode, setOpenNode]);

    const layoutGraph = useCallback(async () => {
      if (!geoMode && !focus) {
        if (layout === "grid" && !hover) {
          await ogma.layouts.grid({ locate: true });
        } else if ((hover ?? layout === "force") || everything) {
          await ogma.layouts.force({
            locate: true,
            gpu: true,
            // gravity: 0.1,
            charge: 20,
            duration: hover ? 0 : undefined,
          });
          if (hover) {
            await ogma.view.locateGraph({ padding: 75 });
          }
        } else if (selectedNode?.node && layout === "radial") {
          await ogma.layouts.radial({
            centralNode: selectedNode.node,
            locate: true,
          });
        } else if (selectedNode?.node && layout === "concentric") {
          await ogma.layouts.concentric({
            centralNode: selectedNode.node,
            locate: true,
          });
        } else if (layout === "hierarchical" && !hover) {
          await ogma.layouts.hierarchical({
            locate: true,
            direction: treeDirection,
          });
        }
      }
    }, [
      everything,
      geoMode,
      focus,
      hover,
      layout,
      selectedNode,
      ogma.layouts,
      ogma.view,
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
      if (!geoMode) updateLayout();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeDirection, threats, layout, geoMode, refreshObserver]);

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
      const clickHandler = ({ target }: MouseButtonEvent<unknown, unknown>) => {
        setSelectedNode(
          target &&
            (!target.isVirtual() ||
              (target.getData() as { location_generated?: boolean })
                ?.location_generated === true) &&
            target.isNode
            ? { node: target, expand: ["summary", "qa"] }
            : null,
        );
        setFocus(null);
      };

      const doubleClickHandler = ({
        target,
      }: MouseButtonEvent<unknown, unknown>) => {
        if (target && !target.isVirtual() && target.isNode) {
          const data = getNodeData(target);
          if (data?.type === "hierarchicalcluster" || data?.type === "threat") {
            setFocus(target);
          } else if (data?.type === "cluster") {
            setFocus(null);
            toggleExpandedCluster(data.id);
            setLayout("force");
            updateLayout();
          }
        }
      };

      // ogma.events.on(["addNodes", "removeNodes"], onNodesAdded);

      ogma.events
        .on("click", clickHandler)
        .on("doubleclick", doubleClickHandler);

      // cleanup
      return () => {
        // ogma.events.off(onNodesAdded);
        ogma.events.off(clickHandler);
        ogma.events.off(doubleClickHandler);
      };
    }, [
      ogma.events,
      setFocus,
      setLayout,
      setSelectedNode,
      toggleExpandedCluster,
      updateLayout,
    ]);

    useImperativeHandle(ref, () => ({
      refresh: updateLayout,
    }));

    const terms = useSearchTerms();

    const isHaloed = useCallback(
      (n: OgmaNode | null) => {
        if (!n) return false;
        const data = getNodeData(n);
        if (data?.type === "cluster") {
          for (const term of terms) {
            if (
              data.summary?.toLowerCase().includes(term) ??
              data.title.toLowerCase().includes(term)
            )
              return true;
          }
        } else if (data?.type === "hierarchicalcluster") {
          const clusters = findAlongPath(
            n,
            "out",
            (node) => getNodeData(node)?.type === "cluster",
          ).filter((node) => isHaloed(node));
          if (clusters.size > 1) return true;
        } else if (data?.type === "article") {
          for (const term of terms) {
            if (
              data.content?.toLowerCase().includes(term) ??
              data.title.toLowerCase().includes(term)
            )
              return true;
          }
        }
        return false;
      },
      [terms],
    );

    return (
      <>
        {hover && <NodeFilter enabled criteria={(n) => !n.isVirtual()} />}
        <EdgeStyleRule
          attributes={{
            shape: (e) => {
              const source = getNodeData(e.getSource());
              const target = getNodeData(e.getTarget());
              if (source?.type === "threat" || target?.type === "threat")
                return {
                  head: "square",
                  tail: "square",
                };
              const tail =
                source?.type === "hierarchicalcluster" ? "arrow" : undefined;
              const head =
                source?.type === "article" ? "sharp-arrow" : undefined;
              return {
                tail,
                head,
              };
            },
            text: (e) => {
              const d = e.getData() as { neo4jType: string } | undefined;
              const content = d?.neo4jType ?? "";
              return {
                size: 15,
                content,
              };
            },
            width: (e) => {
              const d = e.getData() as { neo4jType: string } | undefined;
              if (d?.neo4jType === "SIMILAR_TO") return 2;
              if (edgeOnSelectedPath(e)) return 2;
              return 1;
            },
            color: (e) => {
              if (edgeOnSelectedPath(e)) return "#ee8f00";
              const d = e.getData() as { neo4jType: string } | undefined;
              if (d?.neo4jType === "SIMILAR_TO") return "#000";
            },
          }}
        />

        <NodeStyleRule
          selector={(n) =>
            n.isVirtual() &&
            (n.getData() as { location_generated?: boolean })
              ?.location_generated === false
          }
          attributes={{
            color: "rgb(90,111,196)",
            halo: (n) => {
              if (
                n
                  .getSubNodes()
                  ?.reduce((p: boolean, c) => p || isHaloed(c), false)
              )
                return {
                  color: "yellow",
                  strokeColor: "#ccc",
                  width: 10,
                };
            },

            badges: {
              topRight: {
                scale: 0.6,
                stroke: {
                  width: 0.5,
                },
                text: (n) => `${n.getSubNodes()?.size}`,
              },
            },
            radius: (n) => {
              const data = getNodeData(n);
              if (!data) return;
              const s = scale[data.type];
              if (s) {
                const r =
                  n.getSubNodes()?.reduce((p: number, c) => {
                    const d = getNodeData(c);
                    const r = d ? getNodeRadius(d) : 0;
                    return Math.max(p, r);
                  }, 0) ?? 1;
                return s(r);
              } else {
                return 10;
              }
            },
          }}
        />
        <NodeStyleRule
          selector={(n) =>
            !n.isVirtual() ||
            (n.isVirtual() &&
              (n.getData() as { location_generated?: boolean })
                ?.location_generated === true)
          }
          attributes={{
            text: {
              // scaling: true,
              size: 15,
              content: (n) => {
                const data = getNodeData(n);
                if (data?.type === "hierarchicalcluster")
                  return data.name.replaceAll("_", " ");
                if (data?.type === "cluster") return data.title;
                if (data?.type === "threat") return data.title;
              },
            },
            color: (n) => {
              const data = getNodeData(n);
              return getNodeColor(data);
            },
            radius: (n) => {
              const data = getNodeData(n);
              if (!data) return;
              const r = getNodeRadius(data);
              const s = scale[data.type];
              if (s) {
                return s(r);
              } else {
                console.log(`no scale!  ${data.type}`);
                return 10;
              }
            },
            halo: (n) => {
              if (isHaloed(n))
                return {
                  color: "yellow",
                  strokeColor: "#ccc",
                  width: 10,
                };
            },
          }}
        />
      </>
    );
  },
);
LayoutService.displayName = "LayoutService";
export default LayoutService;
