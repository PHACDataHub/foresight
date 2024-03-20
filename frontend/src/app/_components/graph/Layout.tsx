"use client";

import { type Node as OgmaNode } from "@linkurious/ogma";

import { EdgeStyleRule, NodeStyleRule, useOgma } from "@linkurious/ogma-react";
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
    }: {
      threats: string[];
      dataLoaded: boolean;
      fullScreen: boolean;
      onExitFullScreen?: () => void;
    },
    ref,
  ) => {
    const ogma = useOgma();
    const timer = useRef<NodeJS.Timeout | null>(null);

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
    } = useStore();

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

    const updateLayout = useDebounceCallback(() => {
      // ogma.events.once("idle", () => {
      const go = async () => {
        if (!ogma.geo.enabled() && !focus) {
          if (layout === "hierarchical") {
            await ogma.layouts.hierarchical({
              locate: true,
              direction: treeDirection,
            });
          } else if (layout === "force") {
            await ogma.layouts.force({
              locate: true,
              gpu: true,
              // gravity: 0.1,
              charge: 20,
            });
          }
        }
      };
      void go();
    }, [ogma.events, ogma.geo, ogma.layouts, treeDirection, layout, focus]);

    useEffect(() => {
      if (focus) {
        const related = findAlongPath(focus, "out", () => true);
        const nodes = ogma
          .getNodes()
          .filter((n) => n === focus || related.includes(n));
        const viewSubGraph = async () => {
          if (layout !== "force") {
            await ogma.layouts.force({
              locate: true,
              gpu: true,
              // gravity: 0.1,
              charge: 20,
            });
            setLayout("force");
          }

          await ogma.layouts.force({
            locate: true,
            gpu: true,
            // gravity: 0.1,
            charge: 20,
            centralNode: focus,
            nodes,
          });
        };
        void viewSubGraph();
      }
    }, [focus, layout, ogma, setLayout]);

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
          setSelectedNode(target && target.isNode ? target : null);
          setFocus(null);
        })
        .on("doubleclick", async ({ target }) => {
          if (target && target.isNode) {
            const data = getNodeData(target);
            if (data?.type === "hierarchicalcluster") {
              setFocus(target);
            } else if (data?.type === "cluster") {
              await ogma.removeNodes(
                target.getAdjacentNodes().filter((n) => {
                  const d = getNodeData(n);
                  return d?.type === "article" || d?.type === "threat";
                }),
              );
              setSelectedNode(null);
              setFocus(null);
              setTimeout(() => {
                target.setSelected(false);
              }, 0);
              // updateLayout();
            }
          }
        });

      // cleanup
      return () => {
        ogma.events.off(onNodesAdded);
      };
    }, [ogma, ref, setFocus, setSelectedNode, updateLayout]);

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

    const selectedPath = useMemo(() => {
      if (!selectedNode) return null;
      return findAlongPath(selectedNode, "out", () => true);
    }, [selectedNode]);

    return (
      <>
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
              const dataSource = e.getSource();
              const dataTarget = e.getTarget();
              if (
                selectedPath &&
                (selectedPath.includes(dataSource) ||
                  selectedPath.includes(dataTarget))
              )
                return 2;
              return 1;
            },
            color: (e) => {
              const dataSource = e.getSource();
              const dataTarget = e.getTarget();
              if (
                selectedPath &&
                (selectedPath.includes(dataSource) ||
                  selectedPath.includes(dataTarget))
              )
                return "#ee8f00";
            },
          }}
        />

        <NodeStyleRule
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
              if (data?.type === "cluster") return "#8297ec";
              if (data?.type === "threat") return "#ffb700";
              if (data?.type === "article") {
                if (data.outlier) return "#ffcb3c";
                return "#9073c5";
              }
              return "#d9dae2";
            },
            radius: (n) => {
              const data = getNodeData(n);
              if (!data) return;
              const r = getNodeRadius(data);
              const s = scale.global;
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
