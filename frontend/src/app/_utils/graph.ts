"use client";

import type OgmaLib from "@linkurious/ogma";
import type { NodeList, Node as OgmaNode, RawNode } from "@linkurious/ogma";

import simpleheat from "simpleheat";

import {
  type AllDataTypeProperties,
  type AllDataTypes,
  type ClusterLocation,
} from "~/server/api/routers/post";
import { type LayoutModes, useStore } from "~/app/_store";

export const nodeColours: Record<
  AllDataTypeProperties | "article_outlier" | "other",
  string
> = {
  hierarchicalcluster: "#5A6FC4",
  cluster: "#FFAA29",
  threat: "#DA484A",
  article: "#92A771",
  article_outlier: "#00CF99",
  other: "#D6DAE5",
};

export function findAlongPath(
  n: OgmaNode,
  direction: "in" | "out",
  comp: (node: OgmaNode) => boolean,
): NodeList {
  const nodes = n.getAdjacentNodes({ direction });
  let found = nodes.filter(comp);
  nodes.forEach(
    (ni) => (found = found.concat(findAlongPath(ni, direction, comp))),
  );
  return found;
}

export function getDataId(data?: AllDataTypes) {
  if (!data) return "";
  if (data.type === "threat") return data.title;
  return `${data.id}`;
}

export function getNodeData<T = AllDataTypes | undefined>(
  node: OgmaNode,
): T | undefined {
  const n = node as OgmaNode<AllDataTypes>;
  if (!n) return;
  const data = n.getData();
  return data as T;
}

export function getNodeId(node: OgmaNode): string {
  return getDataId(getNodeData(node));
}

export function getRawNodeData<T = AllDataTypes | undefined>(node: RawNode): T {
  const n = node as RawNode<AllDataTypes>;
  const data = n.data;
  return data as T;
}

export function getRawNodeId(node: RawNode) {
  return getDataId(getRawNodeData(node));
}

export function getNodeRadius(data: AllDataTypes) {
  return data.radius;
}

export function getNodeColor(data?: AllDataTypes) {
  if (
    data?.type &&
    ["hierarchicalcluster", "cluster", "threat"].includes(data.type)
  )
    return nodeColours[data.type];
  if (data?.type === "article") {
    if (data.outlier) return nodeColours.article_outlier;
    return nodeColours.article;
  }
  return nodeColours.other;
}

export function isNodeFiltered(n: OgmaNode, threats: string[]) {
  const data = getNodeData(n);
  if (data?.type === "cluster") {
    // Filter out clusters who are not related to selected threats.
    return (
      n.getAdjacentNodes().filter((an) => {
        const and = getNodeData(an);
        return and?.type === "threat" && threats.includes(and.title);
      }).size === 0
    );
  }
  if (data?.type === "hierarchicalcluster") {
    // Filter out hierachical clusters who have no visible clusters
    const clusters = findAlongPath(
      n,
      "out",
      (a) => getNodeData(a)?.type === "cluster",
    )?.filter((a) => !isNodeFiltered(a, threats));
    if (!clusters || clusters?.size === 0) return true;
  }
  // Filter out threats if they aren't in the list.
  if (data?.type === "threat" && !threats.includes(data.title)) return true;
}

export function isLocationValid(l: ClusterLocation) {
  if (typeof l.latitude !== "number" || typeof l.longitude !== "number")
    return false;
  if (l.location === "") return false;
  return true;
}

export async function applyLayout(
  opts: {
    ogma: OgmaLib;
    onLayoutStart?: () => void;
    onLayoutEnd?: () => void;
  } & (
    | { layout: Exclude<LayoutModes, "concentric" | "radial" | "hierarchical"> }
    | {
        layout: Extract<LayoutModes, "hierarchical">;
        direction: "BT" | "TB" | "LR" | "RL";
      }
    | {
        layout: Extract<LayoutModes, "concentric" | "radial">;
        centralNode: OgmaNode;
      }
  ),
) {
  const { ogma, layout, onLayoutStart, onLayoutEnd } = opts;
  if (onLayoutStart) onLayoutStart();
  const handleOgmaError = () => {
    useStore.setState({ appError: "__layout__error__" });
    handleOnSync();
  };
  const handleOnSync = () => {
    window.removeEventListener("error", handleOgmaError);
    if (onLayoutEnd) onLayoutEnd();
  };
  window.addEventListener("error", handleOgmaError);
  if (layout === "grid") {
    await ogma.layouts.grid({
      locate: true,
      duration: 100,
      onSync: handleOnSync,
    });
  } else if (layout === "force") {
    await ogma.layouts.force({
      locate: {
        duration: 0,
        padding: 0,
      },
      gpu: true,
      duration: 100,
      onSync: handleOnSync,
    });
  } else if (layout === "radial") {
    await ogma.layouts.radial({
      centralNode: opts.centralNode,
      locate: true,
      duration: 100,
      onSync: handleOnSync,
    });
  } else if (layout === "concentric") {
    await ogma.layouts.concentric({
      centralNode: opts.centralNode,
      locate: true,
      duration: 100,
      onSync: handleOnSync,
    });
  } else if (layout === "hierarchical") {
    await ogma.layouts.hierarchical({
      locate: true,
      direction: opts.direction,
      duration: 100,
      onSync: handleOnSync,
    });
  }
}

export function heatMap(ogma: OgmaLib) {
  const canvas = ogma.layers.addCanvasLayer((context) => {
    context.canvas.width = ogma.view.getSize().width;
    context.canvas.height = ogma.view.getSize().height;
    const heat = simpleheat(context.canvas);
    let max: number | null = null;
    let min: number | null = null;

    const data: [number, number, number][] = ogma
      .getNodes()
      .filter((n) => {
        const d = n.getData() as object;
        return "stdev" in d && "stddev_min" in d && "stddev_max" in d;
      })
      .map((n) => {
        const d = n.getData() as object;
        if ("stdev" in d && "stddev_min" in d && "stddev_max" in d) {
          if (max === null) max = d.stddev_max as number;
          if (min === null) min = d.stddev_min as number;
          const { x, y } = n.getPositionOnScreen();
          return [x, y, d.stdev as number];
        }
        return [0, 0, 0];
      });
    if (max !== null) {
      heat.max(max);
    }
    heat.data(data);
    heat.draw();
  });
  canvas.moveToBottom();
  return canvas;
}

//export function hexToRgbA(hex: string, opacity = 1) {
//   let c: string[] | string;
//   if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
//     c = hex.substring(1).split("");
//     if (c.length == 3) {
//       c = [
//         c[0] ?? "0",
//         c[0] ?? "0",
//         c[1] ?? "0",
//         c[1] ?? "0",
//         c[2] ?? "0",
//         c[2] ?? "0",
//       ];
//     }
//     const h = Number("0x" + c.join(""));

//     return (
//       "rgba(" +
//       [(h >> 16) & 255, (h >> 8) & 255, h & 255].join(",") +
//       `,${opacity})`
//     );
//   }
//   throw new Error("Bad Hex");
// }
