import { type CSSProperties, useCallback, useMemo } from "react";

import { faAngleLeft, faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";

import { useTranslations } from "next-intl";

import { type RawNode } from "@linkurious/ogma";

import { Avatar, Button, Divider } from "@mui/material";
import { useStore } from "~/app/_store";

import { type Event } from "~/server/api/routers/post";
import { api } from "~/trpc/react";
import { nodeColours } from "~/app/_utils/graph";

import PersonaAvatar from "./PersonaAvatar";

export default function Workbench() {
  const { showWorkbenchPanel, setPanelWasToggled, setShowWorkbenchPanel } =
    useStore();

  const {
    data: events,
    isFetched,
    refetch,
  } = api.post.listEvents.useQuery(undefined);
  const deleteEvent = api.post.deleteEvent.useMutation();
  const unlinkEvent = api.post.unlinkNodeFromEvent.useMutation();

  const t = useTranslations("Workbench");

  const headerClassNames = useMemo(() => {
    let base = [
      "flex",
      "items-center",
      "justify-between",
      "h-[48px]",
      "pl-[30px]",
      "pr-[12px]",
    ];
    if (showWorkbenchPanel) base = base.concat(["border-b"]);
    if (!showWorkbenchPanel)
      base = base.concat(["border-b", "border-gray-100"]);
    return base.join(" ");
  }, [showWorkbenchPanel]);

  const headerStyles = useMemo(() => {
    const style: CSSProperties = { backgroundColor: "#fff" };
    return style;
  }, []);

  const handleNodeViewToggle = useCallback(() => {
    if (showWorkbenchPanel) setPanelWasToggled(true);
    setShowWorkbenchPanel(!showWorkbenchPanel);
  }, [setPanelWasToggled, setShowWorkbenchPanel, showWorkbenchPanel]);

  const clickHandler = useCallback(() => {
    if (!showWorkbenchPanel) setShowWorkbenchPanel(true);
  }, [setShowWorkbenchPanel, showWorkbenchPanel]);

  const handleDeleteClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const event_id = evt.currentTarget.getAttribute("data-value");
      if (event_id) {
        const submitDelete = async () => {
          await deleteEvent.mutateAsync({ event_id });
          await refetch();
        };
        void submitDelete();
      }
    },
    [deleteEvent, refetch],
  );

  const handleUnlinkClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const event_id = evt.currentTarget.getAttribute("data-event-id");
      const node_id = evt.currentTarget.getAttribute("data-node-id");
      console.log({ event_id, node_id });
      if (event_id && node_id) {
        const submitUnlink = async () => {
          await unlinkEvent.mutateAsync({ event_id, node_id });
          await refetch();
        };
        void submitUnlink();
      }
    },
    [refetch, unlinkEvent],
  );

  return (
    <div
      className={`sdp-sidepanel flex w-full min-w-[480px] flex-col ${!showWorkbenchPanel ? " cursor-pointer" : ""} `}
      onClick={clickHandler}
    >
      <div className={headerClassNames} style={headerStyles}>
        {showWorkbenchPanel && (
          <>
            {/* <Badge max={10000} badgeContent={panelBadge} color="info"> */}
            <Typography variant="h5" fontWeight="bold" fontSize={20}>
              {t("panelTitle")}
            </Typography>
          </>
        )}
        <IconButton onClick={handleNodeViewToggle} color="inherit">
          <FontAwesomeIcon
            icon={showWorkbenchPanel ? faAngleLeft : faAngleRight}
            color="inherit"
          />
        </IconButton>
      </div>
      <div
        className="h-0 flex-auto overflow-auto"
        style={{ display: showWorkbenchPanel ? "block" : "none" }}
      >
        {!isFetched && "Fetching..."}

        {isFetched && (
          <ul>
            {events?.nodes.map((n: RawNode<Event>) => (
              <li key={n.id}>
                <div className="flex items-center space-x-3">
                  <PersonaAvatar persona={n.data?.persona ?? ""} />
                  <h5 className="text-xl font-bold">{n.data?.title}</h5>
                  <Button
                    href=""
                    data-value={n.data?.id}
                    onClick={handleDeleteClick}
                    color="error"
                  >
                    Delete
                  </Button>
                </div>
                <ul>
                  {n.data?.nodes.map((c) => (
                    <li
                      key={c.elementId}
                      className="ml-4 flex items-center space-x-3"
                    >
                      <PersonaAvatar size="small" persona={c.persona} />
                      <Avatar sx={{ bgcolor:nodeColours[c.type], width: 10, height: 10 }}>
                        {" "}
                      </Avatar>
                      <span className="flex-1">{c.title}</span>
                      <Button
                        href=""
                        data-event-id={n.data?.id}
                        data-node-id={c.r_id}
                        onClick={handleUnlinkClick}
                        color="warning"
                      >
                        Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
                <Divider />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
