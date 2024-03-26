import { type NodeList, type Node as OgmaNode } from "@linkurious/ogma";

import { useCallback, useMemo } from "react";
import { type Cluster } from "~/server/api/routers/post";
import { useSearchTerms } from "~/app/_hooks/useSearchTerms";
import { getNodeData } from "~/app/_utils/graph";
import { ClusterNode } from "./ClusterNode";

export default function ClusterNodeList({
  clusterNodes,
}: {
  clusterNodes: NodeList<Cluster>;
}) {
  const terms = useSearchTerms();
  const containsTerm = useCallback((c: OgmaNode<Cluster>) => {
    for (const term of terms) {
      const t = term.toLowerCase();
      const data = getNodeData<Cluster>(c);
      if (
        data.title.toLowerCase().includes(t) ||
        data.summary?.toLowerCase().includes(t)
      )
        return true;
    }
    return false;
  }, [terms]);
  

  const ordered = useMemo(() => {
    if (terms.length === 0) return clusterNodes;
    return clusterNodes
      .map((a) => a)
      .sort((a, b) => {
        const ac = containsTerm(a);
        const bc = containsTerm(b);
        if (ac && !bc) return -1;
        if (bc && !ac) return 1;
        const ad = getNodeData<Cluster>(a);
        const bd = getNodeData<Cluster>(b);
        if (ad.nr_articles > bd.nr_articles) return -1;
        if (ad.nr_articles < bd.nr_articles) return 1;
        return 0;
      });
  }, [clusterNodes, containsTerm, terms.length]);

  return (
    <div className="h-0 flex-auto overflow-auto p-5">
      {ordered.map((c, i) => (
        <ClusterNode key={`clusterList_${i}`} clusterNode={c} />
      ))}
    </div>
  );
}
