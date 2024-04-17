"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  type ImperativePanelGroupHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { faGripLinesVertical } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useParams } from "next/navigation";
import { useStore } from "~/app/_store";
import SidePanel from "~/app/_components/SidePanel";
import Graph from "./graph";

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function PanelInterface() {
  const panelRef = useRef<ImperativePanelGroupHandle>(null);

  const { day } = useParams();

  const { showInfoPanel, toggleRodMode } = useStore();

  const MIN_SIZE_IN_PIXELS = 500;
  const COLLAPSED_SIZE_IN_PIXELS = 70;

  const [minSize, setMinSize] = useState(10);
  const [collpasedSize, setCollapsedSize] = useState(10);
  const [restoreLayout, setRestoreLayout] = useState<number[]>([]);

  const rodModeTracker = useRef<string>("");
  const rodModeTrackerTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const rod = (e: KeyboardEvent) => {
      if (rodModeTrackerTimer.current)
        clearTimeout(rodModeTrackerTimer.current);
      rodModeTrackerTimer.current = setTimeout(() => {
        rodModeTracker.current = "";
      }, 500);
      rodModeTracker.current += e.key;
      if (rodModeTracker.current === "rodmode") toggleRodMode();
    };
    window.addEventListener("keyup", rod);
    return () => {
      window.removeEventListener("keyup", rod);
    };
  }, [toggleRodMode]);

  // Convert left panel minimum size from pixels to %.
  useLayoutEffect(() => {
    const panelGroup = document.querySelector<HTMLDivElement>(
      '[data-panel-group-id="group"]',
    );
    const resizeHandles = document.querySelectorAll<HTMLDivElement>(
      "[data-panel-resize-handle-id]",
    );
    if (!panelGroup) return;
    const observer = new ResizeObserver(() => {
      let width = panelGroup.offsetWidth;
      resizeHandles.forEach((resizeHandle) => {
        width -= resizeHandle.offsetWidth;
      });
      setMinSize((MIN_SIZE_IN_PIXELS / width) * 100);
      setCollapsedSize((COLLAPSED_SIZE_IN_PIXELS / width) * 100);
    });
    observer.observe(panelGroup);
    resizeHandles.forEach((resizeHandle) => {
      observer.observe(resizeHandle);
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    if (!showInfoPanel) {
      setRestoreLayout(panelRef.current.getLayout());
      panelRef.current.setLayout([collpasedSize, 100 - collpasedSize]);
    }
  }, [collpasedSize, showInfoPanel]);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    if (showInfoPanel) {
      if (restoreLayout.length > 0) {
        setRestoreLayout([]);
        panelRef.current.setLayout(restoreLayout);
      }
    }
  }, [restoreLayout, showInfoPanel]);

  if (typeof day !== "string") return "Day error";

  return (
    <PanelGroup
      ref={panelRef}
      autoSaveId="example"
      direction="horizontal"
      id="group"
    >
      <Panel
        defaultSize={25}
        minSize={showInfoPanel ? minSize : collpasedSize}
        className={`flex ${showInfoPanel ? "border-r" : ""}`}
        style={{ transition: "flex 0.1s" }}
        order={1}
      >
        <SidePanel />
      </Panel>
      {showInfoPanel && (
        <PanelResizeHandle className="ml-2 mr-5 flex items-center">
          <FontAwesomeIcon icon={faGripLinesVertical} />
        </PanelResizeHandle>
      )}

      <Panel className="flex" order={2}>
        <Graph />
      </Panel>
    </PanelGroup>
  );
}
