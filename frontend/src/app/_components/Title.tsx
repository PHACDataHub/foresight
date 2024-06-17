import { useCallback, useMemo } from "react";

import type OgmaLib from "@linkurious/ogma";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

import { Locate, Newspaper, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { getDataId, getNodeData, getNodeId } from "~/app/_utils/graph";
import { useStore } from "~/app/_store";
import { type AllDataTypes, type Cluster } from "~/server/api/routers/post";
import { HighlightSearchTerms } from "./HighlightTerms";

export function Title(
  opts:
    | { data: AllDataTypes; showLocate?: boolean; ogma?: OgmaLib }
    | { title: string; ogma?: OgmaLib },
) {
  const { setSelectedNode, selectedNode } = useStore();
  const t = useTranslations("Title");

  const data = "data" in opts ? opts.data : null;
  const showLocate = "showLocate" in opts ? opts.showLocate : false;
  const ogma = opts.ogma;

  const handleOpen = useCallback(() => {
    if (!data) return;
    if (
      selectedNode?.node &&
      getNodeId(selectedNode.node) === getDataId(data)
    ) {
      setSelectedNode(null);
      selectedNode.node.setSelected(false);
      return;
    }
    const n = ogma?.getNodes().filter((n) => getNodeId(n) === getDataId(data));
    if (n?.size === 1 && ogma) {
      const dataNode = n.get(0);
      setSelectedNode({ node: dataNode, activeTab: "articles", ogma });
      dataNode.setSelected(true);
    }
  }, [data, selectedNode?.node, setSelectedNode, ogma]);

  const handleLocate = useCallback(async () => {
    if (!data || !ogma) return;
    const n = ogma?.getNodes().filter((n) => getNodeId(n) === getDataId(data));
    if (n?.size === 1) {
      const dataNode = n.get(0);
      if (!dataNode.isVisible()) {
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
    }
  }, [data, ogma]);

  const title = useMemo(() => {
    if ("title" in opts) return opts.title;
    if (!data) return "";
    if (data.type === "hierarchicalcluster") return data.name ?? "";
    if ("label" in data) return data.label as string ?? "";
    return data.title ?? "";
  }, [data, opts]);

  const isSelected = useMemo(() => {
    if (!selectedNode?.node || !data) return false;
    return getNodeId(selectedNode.node) === getDataId(data);
  }, [data, selectedNode?.node]);

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
      {data && (
        <div className="flex space-x-2">
          <IconButton
            className="foresight-graph-btn sdp-select-node-btn"
            style={{ width: 32, height: 32 }}
            onClick={handleOpen}
            title={t("openTitle", { clear: !isSelected })}
          >
            {!isSelected ? <Newspaper size={22} /> : <Undo2 size={22} />}
          </IconButton>
          {showLocate && (
            <IconButton
              className="foresight-graph-btn sdp-locate-btn"
              style={{ width: 32, height: 32 }}
              onClick={handleLocate}
            >
              <Locate size={22} />
            </IconButton>
          )}
        </div>
      )}
    </div>
  );
}
