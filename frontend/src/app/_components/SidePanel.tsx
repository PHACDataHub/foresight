import { type CSSProperties, useCallback, useMemo } from "react";
import type OgmaLib from "@linkurious/ogma";

import {
  faAngleLeft,
  faAngleRight,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";

import { useTranslations } from "next-intl";
import { useStore } from "~/app/_store";

import ClusterList from "~/app/_components/ClusterList";

import {
  findAlongPath,
  getDataId,
  getNodeColor,
  getNodeData,
  getNodeId,
} from "~/app/_utils/graph";
import { type Cluster } from "~/server/api/routers/post";
import ArticleComponent from "./graph/Article";
import { ClusterView } from "./ClusterView";

export default function SidePanel({
  clusters,
  ogma,
}: {
  clusters: Cluster[];
  ogma?: OgmaLib | null;
}) {
  const { showInfoPanel, setPanelWasToggled, setShowInfoPanel, selectedNode } =
    useStore();

  const t = useTranslations("SidePanel");

  const handleNodeViewToggle = useCallback(() => {
    if (showInfoPanel) setPanelWasToggled(true);
    setShowInfoPanel(!showInfoPanel);
  }, [setPanelWasToggled, setShowInfoPanel, showInfoPanel]);

  const selectedData = useMemo(() => {
    if (selectedNode?.node) return getNodeData(selectedNode.node);
    return null;
  }, [selectedNode?.node]);

  const filteredClusters = useMemo(() => {
    if (!clusters || !selectedData || !selectedNode?.node) return clusters;
    if (selectedData.type === "hierarchicalcluster") {
      const relatedNodes: string[] = findAlongPath(
        selectedNode.node,
        "out",
        () => true,
      ).map((n) => getNodeId(n));
      return clusters.filter((c) => relatedNodes.includes(getDataId(c)));
    }
    if (selectedData.type === "threat") {
      const relatedNodes = findAlongPath(
        selectedNode.node,
        "in",
        () => true,
      ).map((n) => getNodeId(n));
      return clusters.filter((c) => relatedNodes.includes(getDataId(c)));
    }
    return clusters;
  }, [clusters, selectedData, selectedNode?.node]);

  const panelBadge = useMemo(() => {
    if (
      !selectedData ||
      selectedData.type === "threat" ||
      selectedData.type === "hierarchicalcluster"
    )
      return filteredClusters.length;
    return 0;
  }, [filteredClusters.length, selectedData]);

  const headerClassNames = useMemo(() => {
    let base = [
      "flex",
      "items-center",
      "justify-between",
      "h-[48px]",
      "pl-[30px]",
      "pr-[12px]",
    ];
    if (showInfoPanel) base = base.concat(["border-b"]);
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

  const selectedCluster = useMemo(() => {
    if (!selectedNode?.node) return undefined;
    return getNodeData<Cluster>(selectedNode.node);
  }, [selectedNode?.node]);

  if (!clusters && showInfoPanel)
    return (
      <div className="flex w-full flex-col justify-center">
        <FontAwesomeIcon icon={faSpinner} size="4x" spin />
      </div>
    );

  if (!filteredClusters) return;

  return (
    <div
      className={`sdp-sidepanel flex w-full min-w-[480px] flex-col ${!showInfoPanel ? " cursor-pointer" : ""} `}
      onClick={clickHandler}
    >
      <div className={headerClassNames} style={headerStyles}>
        {showInfoPanel && (
          <>
            {/* <Badge max={10000} badgeContent={panelBadge} color="info"> */}
            <Typography variant="h5" fontWeight="bold" fontSize={20}>
              {t("panelTitle", { type: selectedData?.type })}
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
                  {t("id")}
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.id}
                </Typography>
              </div>
              <div className="flex space-x-2">
                <Typography variant="body1" fontSize={14}>
                  {t("clusters")}
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.clusters.length}
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
                  {t("title")}
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.title}
                </Typography>
              </div>
              <div className="flex space-x-2">
                <Typography variant="body1" fontSize={14}>
                  {t("score")}
                </Typography>
                <Typography variant="body1" fontSize={14} fontWeight={500}>
                  {selectedData.score}
                </Typography>
              </div>
            </div>
          </div>
        )}
        <ClusterList clusters={filteredClusters} ogma={ogma ?? undefined} />
      </div>
      {showClusterNode && selectedCluster && selectedNode && (
        <div className={clusterNodeClassNames}>
          <ClusterView
            cluster={selectedCluster}
            activeTab={selectedNode.activeTab}
            details
            ogma={ogma ?? undefined}
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
