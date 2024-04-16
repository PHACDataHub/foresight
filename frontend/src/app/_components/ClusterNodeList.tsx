import { type NodeList } from "@linkurious/ogma";

import { useMemo } from "react";
import { type Cluster } from "~/server/api/routers/post";
import { getNodeData } from "~/app/_utils/graph";
import { useStore } from "~/app/_store";
import { ClusterNode } from "./ClusterNode";

export default function ClusterNodeList({
  clusterNodes,
}: {
  clusterNodes: NodeList<Cluster>;
}) {
  const { searchMatches } = useStore();

  const ordered = useMemo(() => {
    if (searchMatches.length === 0) return clusterNodes;
    return clusterNodes
      .map((a) => a)
      .sort((a, b) => {
        const ac = searchMatches.includes(a.getData("id"));
        const bc = searchMatches.includes(b.getData("id"));
        if (ac && !bc) return -1;
        if (bc && !ac) return 1;
        const ad = getNodeData<Cluster>(a);
        const bd = getNodeData<Cluster>(b);
        if (!ad || !bd) return 0;
        if (ad.nr_articles > bd.nr_articles) return -1;
        if (ad.nr_articles < bd.nr_articles) return 1;
        return 0;
      });
  }, [clusterNodes, searchMatches]);

  return (
    <div className="h-0 flex-auto space-y-[14px] overflow-auto pr-[12px] pt-[10px]">
      {ordered.map((c, i) => (
        <div
          key={`clusterList_${i}`}
          style={
            searchMatches.includes(c.getData("id"))
              ? { padding: 4, backgroundColor: "rgba(255,255,0,0.2)" }
              : {}
          }
        >
          <ClusterNode clusterNode={c} />
        </div>
      ))}
    </div>
  );
}
