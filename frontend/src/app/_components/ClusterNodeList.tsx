import { type NodeList } from "@linkurious/ogma";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleLeft, faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { useCallback } from "react";
import { type Cluster } from "~/server/api/routers/post";
import { useStore } from "~/app/_store";
import { ClusterNode } from "./ClusterNode";

export default function ClusterNodeList({
  clusterNodes,
}: {
  clusterNodes: NodeList<Cluster>;
}) {
  const { showInfoPanel, setShowInfoPanel, setPanelWasToggled } = useStore();

  const handleNodeViewToggle = useCallback(() => {
    if (showInfoPanel) setPanelWasToggled(true);
    setShowInfoPanel(!showInfoPanel);
  }, [setPanelWasToggled, setShowInfoPanel, showInfoPanel]);

  return (
    <>
      <div
        className={`flex justify-between ${showInfoPanel ? "border-b border-gray-200 p-5" : ""}`}
      >
        {showInfoPanel && (
          <>
            <Badge badgeContent={clusterNodes.size} color="info">
              <Typography variant="h5" fontWeight="bold">
                Article Clusters
              </Typography>
            </Badge>
          </>
        )}
        <IconButton onClick={handleNodeViewToggle}>
          <FontAwesomeIcon icon={showInfoPanel ? faAngleLeft : faAngleRight} />
        </IconButton>
      </div>
      {showInfoPanel && (
        <div className="h-0 flex-auto overflow-auto p-5">
          {clusterNodes.map((c, i) => (
            <ClusterNode key={`clusterList_${i}`} clusterNode={c} />
          ))}
        </div>
      )}
    </>
  );
}
