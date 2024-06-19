"use client";

import { type Edge, type Node as OgmaNode } from "@linkurious/ogma";

import { EdgeStyleRule, NodeStyleRule, useOgma } from "@linkurious/ogma-react";
import { useCallback, useMemo } from "react";

import { useStore } from "~/app/_store";
import {
  findAlongPath,
  getNodeData,
  getNodeRadius,
  nodeColours,
} from "~/app/_utils/graph";

const Styles = () => {
  const {
    searchMatches,
    keywordMatches,
    selectedNode,
    persona,
    sourceHighlight,
  } = useStore();
  const ogma = useOgma();

  const radiusFunction = useCallback((n: OgmaNode) => {
    const data = getNodeData(n);
    if (!data) return;
    const r = getNodeRadius(data);
    return r;
  }, []);

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

  const isHaloed = useCallback(
    (n: OgmaNode | null) => {
      if (!n) return false;
      const id = `${n.getData("id")}`;
      if (n.isVirtual()) {
        const subNodes = n.getSubNodes();
        if (subNodes)
          for (let idx = 0; idx < (subNodes?.size ?? 0); idx += 1) {
            if (searchMatches.includes(`${subNodes.get(idx).getData("id")}`))
              return true;
          }
      }
      return searchMatches.includes(id);
    },
    [searchMatches],
  );

  const isKeywordMatched = useCallback(
    (n: OgmaNode | null) => {
      if (!n) return false;
      const id = `${n.getData("id")}`;
      if (n.isVirtual()) {
        const subNodes = n.getSubNodes();
        if (subNodes)
          for (let idx = 0; idx < (subNodes?.size ?? 0); idx += 1) {
            if (keywordMatches.includes(`${subNodes.get(idx).getData("id")}`))
              return true;
          }
      }
      return keywordMatches.includes(id);
    },
    [keywordMatches],
  );

  const isSourceHighlighted = useCallback(
    (n: OgmaNode | null) => {
      if (!n) return false;
      const source = `${n.getData("source")}`;
      return sourceHighlight.includes(source);
    },
    [sourceHighlight],
  );

  return (
    <>
      <NodeStyleRule
        selector={isSourceHighlighted}
        attributes={{ 
          pulse: {
            enabled: true,
            startColor: "#2e7d32",
            endColor: "#2e7d32",
            
            duration: 0,
            width: 1,

          },
          }}
      />
      {/* Node Styling for highlighted terms */}
      <NodeStyleRule
        selector={(n) => isHaloed(n) || isKeywordMatched(n)}
        attributes={{
          halo: {
            color: "yellow",
            strokeColor: (n) => (isKeywordMatched(n) ? "orange" : "#ccc"),
            strokeWidth: (n) => (isKeywordMatched(n) ? 3 : 1),
            width: 10,
          },
        }}
      />
      {/* Node Styling for geoclustered nodes on the map */}
      <NodeStyleRule
        selector={(n) =>
          n.isVirtual() && n.getData("location_generated") === false
        }
        attributes={{
          color: nodeColours.cluster,
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
            return getNodeRadius(data);
          },
        }}
      />
      {/* General node styles */}
      <NodeStyleRule
        selector={(n) =>
          !n.isVirtual() ||
          (n.isVirtual() && n.getData("location_generated") === true)
        }
        attributes={{
          radius: radiusFunction,
        }}
      />
      <NodeStyleRule
        selector={(n) => n.getData("type") === "hierarchicalcluster"}
        attributes={{
          text: {
            size: 15,
            content: (n) =>
              `${n.getData("id")} (${(n.getData("clusters") as []).length})`,
          },
          color: nodeColours.hierarchicalcluster,
        }}
      />
      <NodeStyleRule
        selector={(n) => n.getData("type") === "cluster"}
        attributes={{
          text: {
            size: 15,
            content: (n) => `${n.getData("title") || n.getData("label")}`,
          },
          color: nodeColours.cluster,
        }}
      />
      <NodeStyleRule
        selector={(n) => n.getData("type") === "threat"}
        attributes={{
          text: {
            size: 15,
            content: (n) => `${n.getData("title")}`,
          },
          color: nodeColours.threat,
        }}
      />
      <NodeStyleRule
        selector={(n) =>
          n.getData("type") === "article" &&
          n.getData("outlier") !== true &&
          !Boolean(n.getData("cluster_date"))
        }
        attributes={{
          text: {
            size: 15,
          },
          color: nodeColours.article,
        }}
      />
      <NodeStyleRule
        selector={(n) =>
          n.getData("type") === "article" &&
          n.getData("outlier") !== true &&
          Boolean(n.getData("cluster_date"))
        }
        attributes={{
          text: {
            size: 15,
          },
          color: "red",
        }}
      />
      <NodeStyleRule
        selector={(n) =>
          n.getData("type") === "article" && n.getData("outlier") === true
        }
        attributes={{
          text: {
            size: 15,
          },
          color: nodeColours.article_outlier,
        }}
      />
      <NodeStyleRule
        selector={(n) =>
          ogma.view.isFullScreen() && n.getData("type") === "article"
        }
        attributes={{
          text: {
            content: (n) => `${n.getData("title")}`,
          },
        }}
      />
      {/* Edge Styles */}
      {persona === "tom" && (
        <>
          <EdgeStyleRule
            selector={(e) => e.getData("neo4jType") === "REPRESENTS"}
            attributes={{
              color: "rgba(0,0,255,0.1)",
              stroke: {
                width: 2,
              },
              shape: {
                head: "circle-hole-arrow",
                // tail: "circle-hole-arrow",
              },
            }}
          />
          <EdgeStyleRule
            selector={(e) => e.getSource().getData("type") === "source"}
            attributes={{
              color: "rgba(128, 128, 128, 0.1)",
            }}
          />
        </>
      )}
      <EdgeStyleRule
        attributes={{
          text: (e) => {
            const d = e.getData() as { neo4jType: string } | undefined;
            const content = d?.neo4jType ?? "";
            return {
              size: 15,
              content: content.replaceAll("_", " "),
            };
          },
        }}
      />

      <EdgeStyleRule
        selector={(e) =>
          e.getSource().getData("type") === "threat" ||
          e.getTarget().getData("type") === "threat"
        }
        attributes={{
          shape: {
            head: "square",
            tail: "square",
          },
        }}
      />
      <EdgeStyleRule
        selector={(e) =>
          e.getSource().getData("type") === "hierarchicalcluster"
        }
        attributes={{
          shape: {
            tail: "arrow",
          },
        }}
      />
      <EdgeStyleRule
        selector={(e) =>
          e.getSource().getData("type") === "article" &&
          e.getTarget().getData("type") !== "article"
        }
        attributes={{
          shape: {
            head: "sharp-arrow",
          },
        }}
      />
      <EdgeStyleRule
        selector={(e) =>
          e.getSource().getData("type") === "article" &&
          e.getTarget().getData("type") === "article"
        }
        attributes={{
          shape: {
            head: "short-arrow",
            tail: "short-arrow",
          },
          width: 2,
          color: "#000",
        }}
      />

      <EdgeStyleRule
        selector={edgeOnSelectedPath}
        attributes={{
          width: 2,
          color: "#ee8f00",
        }}
      />
    </>
  );
};

export default Styles;
