import { useCallback, useMemo } from "react";

import { type Node as OgmaNode } from "@linkurious/ogma";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

import { Locate } from "lucide-react";
import { getNodeData } from "~/app/_utils/graph";
import { useStore } from "~/app/_store";
import { type Cluster } from "~/server/api/routers/post";
import { HighlightSearchTerms } from "./HighlightTerms";

export function NodeTitle(opts: { dataNode: OgmaNode } | { title: string }) {
  const { ogma } = useStore();

  const dataNode = "dataNode" in opts ? opts.dataNode : null;

  const handleLocate = useCallback(async () => {
    if (!dataNode) return;
    if (!dataNode.isVisible() && ogma) {
      const d1 = getNodeData<Cluster>(dataNode);
      if (!d1) return;
      const containerNode = ogma.getNodes().filter((n) => {
        if (n.isVirtual()) {
          const subNodes = n.getSubNodes();
          if (subNodes) {
            return (
              subNodes.filter((sn) => getNodeData<Cluster>(sn)?.id === d1.id)
                .size > 0
            );
          }
        }
        return false;
      });
      await containerNode.locate({ duration: 0 });
      await containerNode.pulse();
    }

    await dataNode.locate();
    await dataNode.pulse();
  }, [dataNode, ogma]);

  const title = useMemo(() => {
    if ("title" in opts) return opts.title;
    if (!dataNode) return "";
    const d = getNodeData(dataNode);
    if (d?.type === "hierarchicalcluster") return d.name ?? "";
    return d?.title ?? "";
  }, [dataNode, opts]);

  return (
    <div className="flex items-center justify-between space-x-[24px] p-0">
      <div className="flex-1">
        <Typography
          variant="h4"
          fontWeight={900}
          fontSize={20}
          padding={0}
          margin={0}
        >
          <HighlightSearchTerms text={title} />
        </Typography>
      </div>
      {dataNode && (
        <div className="flex">
          <IconButton
            className="foresight-graph-btn"
            style={{ width: 32, height: 32 }}
            onClick={handleLocate}
          >
            <Locate size={22} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
