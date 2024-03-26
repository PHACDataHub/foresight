"use client";

import {
  type Edge,
  type GeoClustering,
  type MouseButtonEvent,
  type Node as OgmaNode,
} from "@linkurious/ogma";

import {
  EdgeStyleRule,
  NeighborGeneration,
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
import { useStore } from "~/app/_store";
import { findAlongPath, getNodeData, getNodeRadius } from "~/app/_utils/graph";

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
    const geoClustering = useRef<GeoClustering<unknown, unknown> | null>(null);

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
      searchTerms,
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
      console.log("--layout graph--");
      if (!ogma.geo.enabled() && !focus) {
        if (layout === "hierarchical" && !hover && !everything) {
          await ogma.layouts.hierarchical({
            locate: true,
            direction: treeDirection,
          });
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
        }
      }
    }, [
      everything,
      focus,
      hover,
      layout,
      ogma.geo,
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
      updateLayout();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeDirection, threats, geoMode, layout, refreshObserver]);

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
      // register listeners
      // const onNodesAdded = () => {
      //   updateLayout();
      // };

      const clickHandler = ({ target }: MouseButtonEvent<unknown, unknown>) => {
        console.log("click!");
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
        console.log("--doubleclick");
        if (target && !target.isVirtual() && target.isNode) {
          const data = getNodeData(target);
          if (data) console.log(`got data - ${data.type}`);
          if (data?.type === "hierarchicalcluster" || data?.type === "threat") {
            setFocus(target);
          } else if (data?.type === "cluster") {
            // if (
            //   target
            //     .getAdjacentNodes()
            //     .filter((n) => getNodeData(n)?.type === "article").size > 0
            // ) {
            //   await ogma.removeNodes(
            //     target.getAdjacentNodes().filter((n) => {
            //       const d = getNodeData(n);
            //       return d?.type === "article";
            //     }),
            //   );
            //   setFocus(null);
            // } else {
            setFocus(null);
            toggleExpandedCluster(data.id);
            setLayout("force");
            updateLayout();
            // loadArticleGraph(true);
            // setLayout("force");
            // }
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

    const isHaloed = useCallback(
      (n: OgmaNode) => {
        const data = getNodeData(n);
        if (data?.type === "cluster") {
          for (const term of searchTerms) {
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
          for (const term of searchTerms) {
            if (
              data.content?.toLowerCase().includes(term) ??
              data.title.toLowerCase().includes(term)
            )
              return true;
          }
        }
        return false;
      },
      [searchTerms],
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
        {Boolean(scale.cluster) && (
          <NeighborGeneration
            enabled={!hover && geoMode}
            selector={(n) => {
              const d = getNodeData(n);
              return d?.type === "cluster" && d.locations.length > 0;
            }}
            neighborIdFunction={(n) => {
              const d = getNodeData(n);
              if (d?.type !== "cluster") return "UNKNOWN";
              return d.locations
                .filter(
                  (l) =>
                    typeof l.latitude === "number" &&
                    typeof l.longitude === "number",
                )
                .map((l) => JSON.stringify(l));
            }}
            nodeGenerator={(id, nodes) => {
              const n = nodes.get(0);
              if (!n) return {};
              return {
                data: {
                  ...(n.getData() as object),
                  location: JSON.parse(id) as object,
                  location_generated: true,
                },
              };
            }}
            onUpdated={() => {
              if (geoClustering.current === null) {
                geoClustering.current = ogma.transformations.addGeoClustering({
                  enabled: true,
                  radius: 100,
                  nodeGenerator: (nodes) => {
                    const n = nodes.get(0);
                    const data = getNodeData(n);
                    if (!data) return null;
                    if (nodes.size === 1)
                      return {
                        data: {
                          ...data,
                        },
                      };
                    return {
                      data: {
                        ...data,
                        location_generated: false,
                      },
                    };
                  },
                });
              }
            }}
          />
        )}
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
                console.log("no scale for virtual node");
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
              if (data?.type === "hierarchicalcluster") return "#bacf99";
              if (data?.type === "cluster") return "rgb(90,111,196)";
              if (data?.type === "threat") return "#ffb700";
              if (data?.type === "article") {
                if (data.outlier) return "rgb(194,165,247)";
                return "rgb(104,75,157)";
              }
              return "#d9dae2";
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
              // if (selectedPath?.includes(n))
              //   return {
              //     color: "#ee8f00",
              //     width: 5,
              //   };
            },
          }}
        />
      </>
    );
  },
);
LayoutService.displayName = "LayoutService";
export default LayoutService;
