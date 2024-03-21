"use client";

import {
  type Edge,
  type GeoClustering,
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
      locateNode,
      treeDirection,
      geoMode,
      openNode,
      layout,
      setLayout,
      setOpenNode,
      setSelectedNode,
      focus,
      searchTerms,
      selectedNode,
      scale,
      refreshObserver,
      setFocus,
      loadArticleGraph,
    } = useStore();

    const selectedPath = useMemo(() => {
      if (!selectedNode) return null;
      const data = getNodeData(selectedNode);
      if (data?.type === "hierarchicalcluster")
        return findAlongPath(selectedNode, "out", () => true);
      if (data?.type === "cluster" || data?.type === "threat")
        return findAlongPath(selectedNode, "in", () => true);
      return null;
    }, [selectedNode]);

    const edgeOnSelectedPath = useCallback(
      (e: Edge) => {
        const dataTarget = e.getTarget();
        const dataSource = e.getSource();
        return (
          selectedPath &&
          ((selectedNode === dataTarget && selectedPath.includes(dataSource)) ||
            (selectedNode === dataSource &&
              selectedPath.includes(dataTarget)) ||
            (selectedPath.includes(dataSource) &&
              selectedPath.includes(dataTarget)))
        );
      },
      [selectedNode, selectedPath],
    );

    useEffect(() => {
      if (locateNode) {
        const locate = async () => {
          const node = ogma
            .getNodes()
            .filter((n) => (n.getData() as { id: string }).id === locateNode);

          const nodes = ogma.getNodes().filter((n) => {
            const d = n.getData() as { id: string };
            if (d.id === locateNode) return true;
            const adj = n
              .getAdjacentNodes()
              .filter(
                (na) => (na.getData() as { id: string }).id === locateNode,
              );
            if (adj.size > 0) return true;
            return false;
          });

          await nodes.locate();
          await node.pulse();
        };
        void locate();
      }
    }, [locateNode, ogma]);

    useEffect(() => {
      if (openNode) {
        const nodes = ogma
          .getNodes()
          .filter((n) => (n.getData() as { id: string }).id === openNode);
        nodes.setSelected(true);
        setSelectedNode(nodes.get(0));
        setOpenNode(undefined);
      }
    }, [openNode, ogma, setSelectedNode, setOpenNode]);

    const layoutGraph = useCallback(async () => {
      if (!ogma.geo.enabled() && !focus) {
        if (layout === "hierarchical" && !hover) {
          await ogma.layouts.hierarchical({
            locate: true,
            direction: treeDirection,
          });
        } else if (hover ?? layout === "force") {
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
          await ogma.layouts.hierarchical({
            locate: true,
            nodes,
            direction: treeDirection,
          });

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
      // register listener
      const onNodesAdded = () => {
        updateLayout();
      };
      ogma.events.on(["addNodes", "removeNodes"], onNodesAdded);

      ogma.events
        .on("click", ({ target }) => {
          setSelectedNode(
            target &&
              (!target.isVirtual() ||
                (target.getData() as { location_generated?: boolean })
                  ?.location_generated === true) &&
              target.isNode
              ? target
              : null,
          );
          setFocus(null);
        })
        .on("doubleclick", async ({ target }) => {
          if (target && !target.isVirtual() && target.isNode) {
            const data = getNodeData(target);
            if (
              data?.type === "hierarchicalcluster" ||
              data?.type === "threat"
            ) {
              setFocus(target);
            } else if (data?.type === "cluster") {
              setFocus(null);
              loadArticleGraph(true);
              setLayout("force");
              // await ogma.removeNodes(
              //   target.getAdjacentNodes().filter((n) => {
              //     const d = getNodeData(n);
              //     return d?.type === "article" || d?.type === "threat";
              //   }),
              // );
              // setSelectedNode(null);
              // setFocus(null);
              // setTimeout(() => {
              //   target.setSelected(false);
              // }, 0);
              // updateLayout();
            }
          }
        });

      // cleanup
      return () => {
        ogma.events.off(onNodesAdded);
      };
    }, [
      loadArticleGraph,
      ogma,
      ref,
      setFocus,
      setLayout,
      setSelectedNode,
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
              data.summary.toLowerCase().includes(term) ||
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
              data.content.toLowerCase().includes(term) ||
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
                    const s = scale[data.type];
                    return {
                      attributes: {
                        color: "rgb(90,111,196)",
                        radius: s
                          ? s(
                              nodes.reduce((p: number, c) => {
                                const d = getNodeData(c);
                                const r = d ? getNodeRadius(d) : 0;
                                return Math.max(p, r);
                              }, 0),
                            )
                          : 10,
                        badges: {
                          topRight: {
                            scale: 0.6,
                            stroke: {
                              width: 0.5,
                            },
                            text: `${nodes.size}`,
                          },
                        },
                      },
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
                console.log("no scale!");
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
