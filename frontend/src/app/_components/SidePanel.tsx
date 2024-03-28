import { type CSSProperties, useCallback, useMemo } from "react";

import {
  faAngleLeft,
  faAngleRight,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";

import { useStore } from "~/app/_store";

import ClusterNodeList from "~/app/_components/ClusterNodeList";
import { ClusterNode } from "~/app/_components/ClusterNode";
import {
  findAlongPath,
  getNodeColor,
  getNodeData,
  isLocationValid,
} from "~/app/_utils/graph";
import { type Cluster } from "~/server/api/routers/post";
import ArticleComponent from "./graph/Article";

export default function SidePanel() {
  const {
    clusters,
    showInfoPanel,
    setPanelWasToggled,
    setShowInfoPanel,
    selectedNode,
    geoMode,
  } = useStore();

  const handleNodeViewToggle = useCallback(() => {
    if (showInfoPanel) setPanelWasToggled(true);
    setShowInfoPanel(!showInfoPanel);
  }, [setPanelWasToggled, setShowInfoPanel, showInfoPanel]);

  const selectedData = useMemo(() => {
    if (selectedNode?.node) return getNodeData(selectedNode.node);
    return null;
  }, [selectedNode?.node]);

  const filteredClusters = useMemo(() => {
    if (geoMode && clusters) {
      return clusters.filter((c) => {
        const d = getNodeData<Cluster>(c);
        if (!d?.locations) return false;
        return d.locations.filter((l) => isLocationValid(l)).length > 0;
      });
    }
    if (!clusters || !selectedData || !selectedNode?.node) return clusters;
    if (selectedData.type === "hierarchicalcluster") {
      const relatedNodes = findAlongPath(selectedNode.node, "out", () => true);
      return clusters.filter((c) => relatedNodes.includes(c));
    }
    if (selectedData.type === "threat") {
      const relatedNodes = findAlongPath(selectedNode.node, "in", () => true);
      return clusters.filter((c) => relatedNodes.includes(c));
    }
    return clusters;
  }, [clusters, geoMode, selectedData, selectedNode?.node]);

  const panelTitle = useMemo(() => {
    if (selectedData) {
      if (selectedData.type === "cluster") return "Selected Cluster";
      if (selectedData.type === "article") return "Selected Article";
      if (selectedData.type === "hierarchicalcluster")
        return "Clusters in hierarchy";
      if (selectedData.type === "threat") return "Clusters related to threat";
      return "Selected";
    }
    return "Article Clusters";
  }, [selectedData]);

  const panelBadge = useMemo(() => {
    if (
      !selectedData ||
      selectedData.type === "threat" ||
      selectedData.type === "hierarchicalcluster"
    )
      return filteredClusters?.size;
    return 0;
  }, [filteredClusters?.size, selectedData]);

  const headerClassNames = useMemo(() => {
    let base = [
      "flex",
      "items-center",
      "justify-between",
      "h-[48px]",
      "pl-[30px]",
      "pr-[12px]",
    ];
    if (showInfoPanel) base = base.concat(["border-b", "border-t"]);
    if (!showInfoPanel) base = base.concat(["border-b", "border-gray-100"]);
    return base.join(" ");
  }, [showInfoPanel]);

  const headerStyles = useMemo(() => {
    const style: CSSProperties = { backgroundColor: "#fff" };
    if (selectedData) {
      style.backgroundColor = getNodeColor(selectedData);
      style.color = "#fff";
    }
    return style;
  }, [selectedData]);

  const clusterListClassNames = useMemo(() => {
    let base = ["flex", "flex-1", "flex-col", "pl-[30px]"];
    let hide = false;
    if (!showInfoPanel) hide = true;
    if (!hide && selectedData) {
      if (
        selectedData.type !== "hierarchicalcluster" &&
        selectedData.type !== "threat"
      )
        hide = true;
    }
    if (hide) base = base.concat(["hidden"]);
    return base.join(" ");
  }, [selectedData, showInfoPanel]);

  const showClusterNode = useMemo(() => {
    if (selectedData) {
      if (selectedData.type === "cluster") return true;
    }
    return false;
  }, [selectedData]);

  const clickHandler = useCallback(() => {
    if (!showInfoPanel) setShowInfoPanel(true);
  }, [setShowInfoPanel, showInfoPanel]);

  const clusterNodeClassNames = useMemo(() => {
    let base: string[] = ["flex", "flex-1", "flex-col"];
    if (!showInfoPanel || !selectedNode?.node) base = base.concat(["hidden"]);
    return base.join(" ");
  }, [selectedNode?.node, showInfoPanel]);

  const article = useMemo(() => {
    if (selectedData) {
      if (selectedData.type === "article") return selectedData;
    }
    return false;
  }, [selectedData]);

  if (!clusters && showInfoPanel)
    return (
      <div className="flex w-full flex-col justify-center">
        <FontAwesomeIcon icon={faSpinner} size="4x" spin />
      </div>
    );

  if (!filteredClusters) return;

  return (
    <div
      className={`flex w-full flex-col ${!showInfoPanel ? " cursor-pointer border-t" : ""} `}
      onClick={clickHandler}
    >
      <div className={headerClassNames} style={headerStyles}>
        {showInfoPanel && (
          <>
            {/* <Badge max={10000} badgeContent={panelBadge} color="info"> */}
            <Typography variant="h5" fontWeight="bold" fontSize={20}>
              {panelTitle}
              {Boolean(panelBadge && panelBadge > 0) && (
                <Chip
                  label={panelBadge}
                  style={{
                    marginLeft: 10,
                    color: "inherit",
                    fontSize: "0.6em",
                  }}
                />
              )}
            </Typography>
          </>
        )}
        <IconButton onClick={handleNodeViewToggle} color="inherit">
          <FontAwesomeIcon
            icon={showInfoPanel ? faAngleLeft : faAngleRight}
            color="inherit"
          />
        </IconButton>
      </div>
      <div className={clusterListClassNames}>
        {selectedData?.type === "hierarchicalcluster" && (
          <div className="overflow-auto">
            <div className="flex flex-col space-y-[8px] pb-[12px] pt-[12px]">
              <div className="flex space-x-2">
                <Typography variant="body1" fontSize={14}>
                  ID:
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.id}
                </Typography>
              </div>
              <div className="flex space-x-2">
                <Typography variant="body1" fontSize={14}>
                  Clusters:
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.clusters.join(", ")}
                </Typography>
              </div>
            </div>
          </div>
        )}
        {selectedData?.type === "threat" && (
          <div className="overflow-auto">
            <div className="flex flex-col space-y-[8px] pb-[12px] pt-[12px]">
              <div className="flex space-x-2">
                <Typography variant="body1" fontSize={14}>
                  Title:
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.title}
                </Typography>
              </div>
              <div className="flex space-x-2">
                <Typography variant="body1" fontSize={14}>
                  Score
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.score}
                </Typography>
              </div>
            </div>
          </div>
        )}
        <ClusterNodeList clusterNodes={filteredClusters} />
      </div>
      {showClusterNode && selectedNode?.node && (
        <div className={clusterNodeClassNames}>
          <ClusterNode
            clusterNode={selectedNode.node}
            expand={selectedNode.expand}
            details
          />
        </div>
      )}
      {article && (
        <div className={clusterNodeClassNames} style={{ paddingLeft: 30 }}>
          <ArticleComponent article={article} standAlone />
        </div>
      )}
    </div>
  );
}
