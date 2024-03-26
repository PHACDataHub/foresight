import { useCallback, useMemo } from "react";

import { type Node as OgmaNode } from "@linkurious/ogma";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";

import { getNodeData } from "~/app/_utils/graph";
import { HighlightSearchTerms } from "./HighlightTerms";

export function NodeTitle({ dataNode }: { dataNode: OgmaNode }) {
  
  const handleLocate = useCallback(async () => {
    // const node = ogma
    //   .getNodes()
    //   .filter((n) => (n.getData() as { id: string }).id === locateNode);

    // const nodes = ogma.getNodes().filter((n) => {
    //   const d = n.getData() as { id: string };
    //   if (d.id === locateNode) return true;
    //   const adj = n
    //     .getAdjacentNodes()
    //     .filter((na) => (na.getData() as { id: string }).id === locateNode);
    //   if (adj.size > 0) return true;
    //   return false;
    // });

    await dataNode.locate();
    await dataNode.pulse();
  }, [dataNode]);

  const title = useMemo(() => {
    const d = getNodeData(dataNode);
    if (d?.type === "hierarchicalcluster") return d.name ?? "";
    return d?.title ?? "";
  }, [dataNode]);

  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex-1">
        <Typography variant="h4">
            <HighlightSearchTerms text={title} />
        </Typography>
      </div>
      <div className="flex">
        <IconButton onClick={handleLocate}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </IconButton>
      </div>
    </div>
  );
}
