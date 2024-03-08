"use client";

import { useOgma } from "@linkurious/ogma-react";
import {
  type EdgeList,
  type MouseOverEvent,
  type NodeList,
  type Node as OgmaNode,
} from "@linkurious/ogma";

import { useEffect, useRef } from "react";

interface HighlightState {
  node?: OgmaNode;
  visibleEdges?: boolean[];
  edgesToHighlight?: EdgeList;
  nodesToHighlight?: NodeList;
  edgesToDim?: EdgeList;
  nodesToDim?: NodeList;
}

export default function Hightlighter() {
  const ogma = useOgma();
  const highlights = useRef<HighlightState>({});

  useEffect(() => {
    if (!ogma.styles.getClass("highlighted"))
      ogma.styles.createClass({
        name: "highlighted",
        nodeAttributes: {
          color: "#916699",
          // radius: (n) => +n.getAttribute("radius") * 2,
        },
        edgeAttributes: {
          color: "#916699",
          // width: (e) => +e.getAttribute("width") * 2,
        },
      });
    if (!ogma.styles.getClass("dimmed"))
      ogma.styles.createClass({
        name: "dimmed",
        nodeAttributes: { opacity: 0.15 },
        edgeAttributes: { opacity: 0.15 },
      });

    ogma.styles.setHoveredNodeAttributes(null);
    const clearHighlight = () => {
      if (!highlights.current.node) return;
      void highlights.current.edgesToDim?.removeClass("dimmed", 250);
      void highlights.current.edgesToHighlight?.removeClass("highlighted");
      highlights.current.edgesToHighlight?.forEach((n, i) =>
        n.setVisible(highlights.current.visibleEdges?.at(i) ?? false),
      );
      void highlights.current.nodesToHighlight?.removeClass("highlighted");
      void highlights.current.nodesToDim?.removeClass("dimmed", 250);
      highlights.current.node = undefined;
    };
    const onMouseOver = ({ target }: MouseOverEvent<unknown, unknown>) => {
      if (!target || !target.isNode) return;
      clearHighlight();
      highlights.current.node = target;
      highlights.current.edgesToHighlight = target.getAdjacentEdges({
        filter: "all",
      });
      highlights.current.visibleEdges = highlights.current.edgesToHighlight.map(
        (e) => e.isVisible(),
      );
      highlights.current.edgesToDim = ogma
        .getEdges()
        .filter(
          (edge) =>
            !highlights.current.edgesToHighlight?.filter((e) => e === edge)
              .size,
        );

      highlights.current.nodesToHighlight = ogma.getNodes(
        highlights.current.edgesToHighlight
          .map((edge) =>
            edge.getSource() === target ? edge.getTarget() : edge.getSource(),
          )
          .filter((node) => !node.isVirtual())
          .concat(target)
          .map((node) => node.getId()),
      );

      highlights.current.nodesToDim = ogma
        .getNodes()
        .filter(
          (node) =>
            !node.getAdjacentNodes().includes(target) && target !== node,
        );

      highlights.current.edgesToHighlight.setVisible(true);
      void highlights.current.edgesToHighlight.addClass("highlighted");
      void highlights.current.edgesToDim.addClass("dimmed", 250);
      void highlights.current.nodesToHighlight.addClass("highlighted");
      void highlights.current.nodesToDim.addClass("dimmed", 250);
    };
    ogma.events.on("mouseover", onMouseOver);
    ogma.events.on("mouseout", clearHighlight);
    return () => {
      ogma.events.off(onMouseOver);
      ogma.events.off(clearHighlight);
    };
  }, [ogma]);

  return null;
}
