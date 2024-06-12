import { type CSSProperties, useCallback, useMemo, useState } from "react";
import type OgmaLib from "@linkurious/ogma";
import { type RawNode } from "@linkurious/ogma";

import {
  faAngleLeft,
  faAngleRight,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import { useTranslations } from "next-intl";
import { Button } from "@mui/material";
import { useStore } from "~/app/_store";

import ClusterList from "~/app/_components/ClusterList";

import {
  findAlongPath,
  getDataId,
  getNodeColor,
  getNodeData,
  getNodeId,
} from "~/app/_utils/graph";
import { type Cluster, type Event } from "~/server/api/routers/post";
import { api } from "~/trpc/react";
import ArticleComponent from "./graph/Article";
import { ClusterView } from "./ClusterView";
import PersonaAvatar from "./PersonaAvatar";

export default function SidePanel({
  clusters,
  ogma,
}: {
  clusters: Cluster[];
  ogma?: OgmaLib | null;
}) {
  const {
    showInfoPanel,
    setPanelWasToggled,
    setShowInfoPanel,
    setShowWorkbenchPanel,
    selectedNode,
    persona,
    feature_workbench,
  } = useStore();

  const t = useTranslations("SidePanel");

  const handleNodeViewToggle = useCallback(() => {
    if (showInfoPanel) setPanelWasToggled(true);
    setShowInfoPanel(!showInfoPanel);
  }, [setPanelWasToggled, setShowInfoPanel, showInfoPanel]);

  const selectedData = useMemo(() => {
    if (selectedNode?.node) return getNodeData(selectedNode.node);
    return null;
  }, [selectedNode?.node]);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const existingEventOpen = useMemo(() => Boolean(anchorEl), [anchorEl]);
  const createEvent = api.post.createEvent.useMutation();
  const addToEvent = api.post.addToEvent.useMutation();
  const eventQuery = api.post.listEvents.useQuery(undefined, {
    enabled: false,
  });

  const handleAddToExistingEventClick = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    setAnchorEl(event.currentTarget);
  };
  const handleExistingEventClose = useCallback(() => {
    setAnchorEl(null);
  }, []);
  const handleExistingEventClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      setAnchorEl(null);
      const event_id = evt.currentTarget.getAttribute("data-value");
      const submitAddEvent = async () => {
        try {
          if (
            (selectedData?.type === "article" ||
              selectedData?.type === "cluster") &&
            typeof event_id === "string"
          ) {
            await addToEvent.mutateAsync({
              event_id,
              persona,
              nodes: [{ type: selectedData.type, id: `${selectedData.id}` }],
            });
            void eventQuery.refetch();
            setShowWorkbenchPanel(true);
          } else alert("error condition");
        } catch (e) {
          alert(
            `Unable to create event.  ${(e as { message: string }).message}`,
          );
          console.error(e);
        }
      };
      void submitAddEvent();
    },
    [addToEvent, eventQuery, persona, selectedData, setShowWorkbenchPanel],
  );

  const handleCreateEventClick = useCallback(() => {
    if (selectedData?.type === "article" || selectedData?.type === "cluster") {
      const submitCreateEvent = async () => {
        try {
          await createEvent.mutateAsync({
            persona,
            nodes: [{ type: selectedData.type, id: `${selectedData.id}` }],
          });
          void eventQuery.refetch();
          setShowWorkbenchPanel(true);
        } catch (e) {
          alert(
            `Unable to create event.  ${(e as { message: string }).message}`,
          );
          console.error(e);
        }
      };
      void submitCreateEvent();
    } else alert("error condition");
  }, [createEvent, eventQuery, persona, selectedData, setShowWorkbenchPanel]);

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
      {feature_workbench &&
        showInfoPanel &&
        selectedData &&
        (selectedData.type === "article" ||
          selectedData.type === "cluster") && (
          <div className="mt-3 flex justify-center space-x-3">
            <Button onClick={handleCreateEventClick} variant="contained">
              Create new event
            </Button>
            <Button
              onClick={handleAddToExistingEventClick}
              disabled={!eventQuery.data || eventQuery.data?.nodes.length === 0}
              variant="contained"
              aria-controls={existingEventOpen ? "existing-events" : undefined}
              aria-haspopup="true"
              aria-expanded={existingEventOpen ? "true" : undefined}
            >
              Add to existing event
            </Button>
            <Menu
              anchorEl={anchorEl}
              id="existing-events"
              open={existingEventOpen}
              onClose={handleExistingEventClose}
              onClick={handleExistingEventClose}
              slotProps={{
                paper: {
                  elevation: 0,
                  sx: {
                    overflow: "visible",
                    filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
                    minWidth: 300,
                    mt: 1.5,
                    "& .MuiAvatar-root": {
                      width: 32,
                      height: 32,
                      ml: -0.5,
                      mr: 1,
                    },
                    "&::before": {
                      content: '""',
                      display: "block",
                      position: "absolute",
                      top: 0,
                      right: 14,
                      width: 10,
                      height: 10,
                      bgcolor: "background.paper",
                      transform: "translateY(-50%) rotate(45deg)",
                      zIndex: 0,
                    },
                  },
                },
              }}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              {eventQuery.data?.nodes.map((p: RawNode<Event>) => (
                <MenuItem
                  key={p.id}
                  href=""
                  onClick={handleExistingEventClick}
                  data-value={p.data?.id}
                >
                  <PersonaAvatar persona={p.data?.persona ?? ""} size="small" />
                  {p.data?.title}
                </MenuItem>
              ))}
            </Menu>
          </div>
        )}

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
