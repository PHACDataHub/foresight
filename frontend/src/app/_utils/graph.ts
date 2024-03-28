import {
  type Neo4JEdgeData,
  type NodeList,
  type Node as OgmaNode,
  type RawGraph,
  type RawNode,
} from "@linkurious/ogma";
import * as d3 from "d3";
import {
  type AllDataTypeProperties,
  type AllDataTypes,
  type ClusterLocation,
} from "~/server/api/routers/post";

export const MAX_RADIUS = 20;
export const MIN_RADIUS = 2;

export const nodeColours: Record<
  AllDataTypeProperties | "article_outlier" | "other",
  string
> = {
  hierarchicalcluster: "#5A6FC4",
  cluster: "#FFAA29",
  threat: "#DA484A",
  article: "#92A771",
  article_outlier: "#BACF99",
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

export function getNodeData<T = AllDataTypes | undefined>(node: OgmaNode): T {
  const n = node as OgmaNode<AllDataTypes>;
  const data = n.getData();
  return data as T;
}

export function getRawNodeData<T = AllDataTypes | undefined>(node: RawNode): T {
  const n = node as RawNode<AllDataTypes>;
  const data = n.data;
  return data as T;
}

export function getNodeRadius(data: AllDataTypes) {
  if (data?.type === "hierarchicalcluster") return data.clusters.length;
  if (data?.type === "cluster") return data.nr_articles;
  if (data?.type === "threat") return data.score ? data.score : 1;
  if (data?.type === "article") return data.prob_size;
  return -1;
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
  if (typeof l.latitude !== "number" || typeof l.longitude !== "number") return false;
  if (l.location === "") return false;
  return true;
}

export function createScale(
  g: RawGraph<AllDataTypes, Neo4JEdgeData<Record<string, unknown>>>,
) {
  const ret: Record<
    "cluster" | "hierarchicalcluster" | "threat" | "article" | "global",
    { min?: number; max?: number }
  > = {
    cluster: {},
    hierarchicalcluster: {},
    threat: {},
    article: {},
    global: {},
  };
  g.nodes.forEach((n) => {
    const data = n.data;
    if (!data) return;
    const r = getNodeRadius(data);

    const gomi = ret.global.min ?? r;
    const goma = ret.global.max ?? r;
    ret.global = {
      min: Math.min(gomi, r),
      max: Math.max(goma, r),
    };

    if (
      data?.type === "hierarchicalcluster" ||
      data?.type === "cluster" ||
      data?.type === "threat" ||
      data?.type === "article"
    ) {
      const omi = ret[data.type].min ?? r;
      const oma = ret[data.type].max ?? r;
      ret[data.type] = {
        min: Math.min(omi, r),
        max: Math.max(oma, r),
      };
    }
  });
  return {
    global:
      typeof ret.global.min === "number" && typeof ret.global.max === "number"
        ? d3
            .scaleLog([MIN_RADIUS, MAX_RADIUS])
            .domain([ret.global.min, ret.global.max])
        : null,

    cluster:
      typeof ret.cluster.min === "number" && typeof ret.cluster.max === "number"
        ? d3
            .scaleLog([MIN_RADIUS * 2, MAX_RADIUS * 2])
            .domain([ret.cluster.min, ret.cluster.max])
        : null,
    hierarchicalcluster:
      typeof ret.hierarchicalcluster.min === "number" &&
      typeof ret.hierarchicalcluster.max === "number"
        ? d3
            .scaleLog([MIN_RADIUS * 1.5, MAX_RADIUS * 1.5])
            .domain([ret.hierarchicalcluster.min, ret.hierarchicalcluster.max])
        : null,

    threat:
      typeof ret.threat.min === "number" && typeof ret.threat.max === "number"
        ? d3
            .scaleLog([MIN_RADIUS * 1.7, MAX_RADIUS * 1.7])
            .domain([ret.threat.min, ret.threat.max])
        : null,

    article:
      typeof ret.article.min === "number" && typeof ret.article.max === "number"
        ? d3
            .scaleLog([MIN_RADIUS / 2, MAX_RADIUS / 2])
            .domain([ret.article.min, ret.article.max])
        : null,
  };
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
