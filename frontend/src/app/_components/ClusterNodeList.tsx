import { type NodeList } from "@linkurious/ogma";
import { type Cluster } from "~/server/api/routers/post";
import { ClusterNode } from "./ClusterNode";

export default function ClusterNodeList({
  clusterNodes,
}: {
  clusterNodes: NodeList<Cluster>;
}) {
  return (
    <>
      <h3
        className="mt-0 flex justify-between p-5 text-white"
        style={{ background: "rgb(90,111,196)" }}
      >
        <span>Article Clusters</span>
        <span>{clusterNodes.size}</span>
      </h3>
      <div className="h-0 flex-auto overflow-auto pl-5 pr-5 text-2xl">
        {clusterNodes.map((c, i) => (
          <ClusterNode key={`clusterList_${i}`} clusterNode={c} />
        ))}
      </div>
    </>
  );
}
