import { type NodeList, type Node as OgmaNode } from "@linkurious/ogma";
import { type AllDataTypes } from "~/server/api/routers/post";

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

export function getNodeData(node: OgmaNode): AllDataTypes | undefined {
  const n = node as OgmaNode<AllDataTypes>;
  const data = n.getData();
  return data;
}

export function getNodeRadius(data: AllDataTypes) {
  if (data?.type === "hierarchicalcluster") return data.clusters.length / 3;
  if (data?.type === "cluster") return data.nr_articles * 5;
  if (data?.type === "threat") return data.score ? data.score * 5 : 2.5;
  if (data?.type === "article") return data.prob_size;
  return -1;
}

export function isNodeFiltered(n: OgmaNode, threats: string[]) {
  const data = getNodeData(n);
  if (
    data?.type === "cluster" &&
    data.threats &&
    data.threats.filter((t) => threats.includes(t.title)).length === 0
  )
    return true;
  if (data?.type === "hierarchicalcluster") {
    const clusters = findAlongPath(
      n,
      "out",
      (a) => getNodeData(a)?.type === "cluster",
    )?.filter((a) => !isNodeFiltered(a, threats));
    if (!clusters || clusters?.size === 0) return true;
  }
  if (data?.type === "threat" && !threats.includes(data.title)) return true;
};