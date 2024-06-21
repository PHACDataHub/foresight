import { useMemo } from "react";
import type OgmaLib from "@linkurious/ogma";
import { Typography } from "@mui/material";
import { type AllDataTypes } from "~/server/api/routers/post";
import { useStore } from "~/app/_store";
import { Title } from "./Title";
import { HighlightSearchTerms } from "./HighlightTerms";

export default function SemanticResultList({ ogma }: { ogma?: OgmaLib }) {
  const { searchMatches, keywordMatches, semanticMatches } = useStore();

  const nodes = useMemo(() => {
    if (!ogma) return [];

    return semanticMatches
      .filter((s) => ogma.getNode(s.id))
      .map((s) => {
        const node = ogma.getNode(s.id);
        if (!node) throw new Error("Unable to locate node.");
        return {
          ...s,
          type: node.getData("type") as string,
          node,
        };
      });
  }, [ogma, semanticMatches]);

  return (
    <div className="h-0 flex-auto space-y-[14px] overflow-auto pr-[12px] pt-[10px]">
      {nodes.map((c, i) => {
        const c_id = `${c.node.getId()}`;
        return (
          <div
            key={`clusterList_${i}`}
            style={
              c &&
              (keywordMatches.includes(c_id)
                ? { borderLeft: "7px solid yellow" }
                : searchMatches.includes(c_id)
                  ? { borderLeft: "12px solid yellow" }
                  : {})
            }
          >
            <div
              className="flex space-x-2"
              style={
                c &&
                (keywordMatches.includes(c_id)
                  ? { borderLeft: "5px solid orange", paddingLeft: "10px" }
                  : searchMatches.includes(c_id)
                    ? { borderLeft: "1px solid #bbb", paddingLeft: "10px" }
                    : {})
              }
            >
              {/* <ClusterView cluster={c} ogma={ogma} /> */}
              <Typography variant="h6">{i + 1}.</Typography>
              <div className="flex-1">
                <Title
                  data={c.node.getData() as AllDataTypes}
                  ogma={ogma}
                  showLocate
                />
                <section className="border-b mb-2">
                  <Typography variant="body1" fontSize={14}>
                    <HighlightSearchTerms
                      text={(c.node.getData("summary") as string) ?? ""}
                    />
                  </Typography>
                </section>
                <Typography variant="body2" fontSize={12}>
                Score: {c.score}
                </Typography>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
