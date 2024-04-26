import { useMemo } from "react";
import type OgmaLib from "@linkurious/ogma";
import { type Cluster } from "~/server/api/routers/post";
import { getDataId, getRawNodeData } from "~/app/_utils/graph";
import { useStore } from "~/app/_store";
import { ClusterView } from "./ClusterView";

export default function ClusterList({
  clusters,
  ogma,
}: {
  clusters: Cluster[];
  ogma?: OgmaLib;
}) {
  const { searchMatches } = useStore();

  const ordered = useMemo(() => {
    if (searchMatches.length === 0) return clusters;
    return clusters
      .map((a) => a)
      .sort((a, b) => {
        const ac = searchMatches.includes(getDataId(a));
        const bc = searchMatches.includes(getDataId(b));
        if (ac && !bc) return -1;
        if (bc && !ac) return 1;
        const ad = getRawNodeData<Cluster>(a);
        const bd = getRawNodeData<Cluster>(b);
        if (!ad || !bd) return 0;
        if (ad.nr_articles > bd.nr_articles) return -1;
        if (ad.nr_articles < bd.nr_articles) return 1;
        return 0;
      });
  }, [clusters, searchMatches]);

  return (
    <div className="h-0 flex-auto space-y-[14px] overflow-auto pr-[12px] pt-[10px]">
      {ordered.map((c, i) => (
        <div
          key={`clusterList_${i}`}
          style={
            c && searchMatches.includes(getDataId(c))
              ? { padding: 4, backgroundColor: "rgba(255,255,0,0.2)" }
              : {}
          }
        >
          <ClusterView cluster={c} ogma={ogma} />
        </div>
      ))}
    </div>
  );
}
