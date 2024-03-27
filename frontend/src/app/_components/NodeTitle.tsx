import { useCallback, useMemo } from "react";

import { type Node as OgmaNode } from "@linkurious/ogma";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

import { getNodeData } from "~/app/_utils/graph";
import { useStore } from "~/app/_store";
import { type Cluster } from "~/server/api/routers/post";
import { HighlightSearchTerms } from "./HighlightTerms";

export function NodeTitle({ dataNode }: { dataNode: OgmaNode }) {
  const { ogma } = useStore();
  const handleLocate = useCallback(async () => {
    if (!dataNode.isVisible() && ogma) {
      const d1 = getNodeData<Cluster>(dataNode);
      const containerNode = ogma.getNodes().filter((n) => {
        if (n.isVirtual()) {
          const subNodes = n.getSubNodes();
          if (subNodes) {
            return (
              subNodes.filter((sn) => getNodeData<Cluster>(sn).id === d1.id)
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
    const d = getNodeData(dataNode);
    if (d?.type === "hierarchicalcluster") return d.name ?? "";
    return d?.title ?? "";
  }, [dataNode]);

  return (
    <div className="flex items-center justify-between p-0">
      <div className="flex-1">
        <Typography variant="h4" fontSize={20} padding={0} margin={0}>
          <HighlightSearchTerms text={title} />
        </Typography>
      </div>
      <div className="flex">
        <IconButton onClick={handleLocate} sx={{padding: 0, margin: 0}}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </IconButton>
      </div>
    </div>
  );
}
