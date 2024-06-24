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
  const { searchMatches, keywordMatches, semanticMatches } = useStore();

  const ordered = useMemo(() => {
    if (
      searchMatches.length + keywordMatches.length + semanticMatches.length ===
      0
    )
      return clusters;
    const sm = semanticMatches.map((s) => `${s.id}`);
    return clusters
      .map((a) => a)
      .sort((a, b) => {
        const sac = sm.findIndex((i) => i === getDataId(a));
        const sbc = sm.findIndex((i) => i === getDataId(b));
        if (sac >= 0 && sbc >= 0) return sac - sbc;
        if (sac >= 0 && sbc === -1) return -1;
        if (sbc >= 0 && sac === -1) return 1;
        const kac = keywordMatches.includes(getDataId(a));
        const kbc = keywordMatches.includes(getDataId(b));
        if (kac && !kbc) return -1;
        if (kbc && !kac) return 1;
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
  }, [clusters, searchMatches, keywordMatches, semanticMatches]);

  const sm = useMemo(
    () => semanticMatches.map((s) => `${s.id}`),
    [semanticMatches],
  );

  return (
    <div className="h-0 flex-auto space-y-[14px] overflow-auto pr-[12px] pt-[10px]">
      {ordered.map((c, i) => {
        const c_id = getDataId(c);
        return (
          <div
            key={`clusterList_${i}`}
            style={
              c &&
              (sm.includes(c_id) || keywordMatches.includes(c_id)
                ? { borderLeft: "7px solid yellow" }
                : searchMatches.includes(c_id)
                  ? { borderLeft: "12px solid yellow" }
                  : {})
            }
          >
            <div
              style={
                c &&
                (sm.includes(c_id)
                  ? { borderLeft: "5px solid red", paddingLeft: "10px" }
                  : keywordMatches.includes(c_id)
                    ? { borderLeft: "5px solid orange", paddingLeft: "10px" }
                    : searchMatches.includes(c_id)
                      ? { borderLeft: "1px solid #bbb", paddingLeft: "10px" }
                      : {})
              }
            >
              {sm.includes(c_id) && (
                <div className="flex space-x-2">
                  <span>
                    Position:{" "}
                    {semanticMatches.findIndex((s) => `${s.id}` === c_id) + 1}
                  </span>
                  <span>
                    Score:{" "}
                    {semanticMatches.find((s) => `${s.id}` === c_id)?.score}
                  </span>
                </div>
              )}
              <ClusterView cluster={c} ogma={ogma} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
