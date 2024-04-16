"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import L from "leaflet";

import "leaflet.gridlayer.googlemutant";
import { Loader } from "@googlemaps/js-api-loader";

import {
  type ImperativePanelGroupHandle,
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";

import { NodeFilter, Ogma } from "@linkurious/ogma-react";
import OgmaLib from "@linkurious/ogma";

import {
  faGripLinesVertical,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  CircleDot,
  Diameter,
  FileSearch,
  FileX2,
  Grip,
  Map,
  Maximize2,
  Minimize2,
  RefreshCcw,
  Satellite,
  Waypoints,
  Workflow,
} from "lucide-react";

import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import FormGroup from "@mui/material/FormGroup";
import FormControl from "@mui/material/FormControl";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import InputLabel from "@mui/material/InputLabel";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

import "leaflet/dist/leaflet.css";
import { useResizeObserver } from "usehooks-ts";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import useDebounceCallback from "~/app/_hooks/useDebouncedCallback";
import { type LayoutModes, useStore } from "~/app/_store";
import { createScale, findAlongPath, getNodeData } from "~/app/_utils/graph";
import SidePanel from "~/app/_components/SidePanel";
import { env } from "~/env";
import { api } from "~/trpc/react";
import LayoutService, { type LayoutServiceRef } from "./Layout";

import DataLoader from "./DataLoader";
import TimeLine from "./TimeLine";
import LocationTransforms from "./LocationTransforms";
import Styles from "./Styles";
import Interactions from "./Interactions";

OgmaLib.libraries.leaflet = L;

export interface Country {
  country: string;
  latitude: string;
  longitude: string;
  name: string;
}

export default function Graph() {
  const ref = useRef<HTMLDivElement | null>(null);
  const ogmaParentContainer = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const ogmaRef = useRef<OgmaLib | null>(null);
  const ogmaHoverRef = useRef<OgmaLib | null>(null);
  const ogmaHoverContainerRef = useRef<HTMLDivElement | null>(null);
  const layoutService = useRef<LayoutServiceRef | null>(null);
  const panelRef = useRef<ImperativePanelGroupHandle>(null);

  const { height, width } = useResizeObserver({ ref, box: "border-box" });
  const { day, locale } = useParams();
  const [dataLoading, setDataLoading] = useState(false);

  const getArticles = api.post.getArticles.useMutation();
  const [cachedExpansion, setCachedExpansion] = useState(false);

  const t = useTranslations();

  const {
    history,
    showInfoPanel,
    toggleTreeDirection,
    layout,
    setLayout,
    geoMode,
    setGeoMode,
    threats,
    clusterId,
    setFocus,
    refresh,
    setOgma,
    expandedClusters,
    setExpandedClusters,
    everything,
    setEverything,
    selectedNode,
    rodMode,
    toggleRodMode,
    mapMode,
    setMapMode,
    augmentScale,
    ogma,
    setFeature_GroupArticleBy,
    feature_GroupArticleBy,
    layoutBusy,
    setLayoutBusy,
    setLayoutNotBusy,
  } = useStore();

  const MIN_SIZE_IN_PIXELS = 500;
  const COLLAPSED_SIZE_IN_PIXELS = 70;

  const [minSize, setMinSize] = useState(10);
  const [collpasedSize, setCollapsedSize] = useState(10);
  const [restoreLayout, setRestoreLayout] = useState<number[]>([]);

  const rodModeTracker = useRef<string>("");
  const rodModeTrackerTimer = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  useEffect(() => {
    setCachedExpansion(false);
  }, [threats]);

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

  const handleExpandRelatedClusters = useCallback(() => {
    if (!ogma) return;
    const clusters =
      selectedNode?.node.getData("type") === "hierarchicalcluster"
        ? findAlongPath(
            selectedNode.node,
            "out",
            (n) => n.getData("type") === "cluster",
          )
        : ogma.getNodes().filter((n) => getNodeData(n)?.type === "cluster");
    if (clusters.size === 0) return;
    setExpanding(true);
    setLayout("force");
    setExpandedClusters(clusters.map((c) => c.getData("id") as string));

    const get_articles = async () => {
      if (typeof day !== "string") return;
      if (!cachedExpansion) {
        const articles = await getArticles.mutateAsync({
          day: parseInt(day),
          history,
          threats,
        });
        // setCachedExpansion(true);
        augmentScale(createScale(articles));
        const batchSize = articles.nodes.length < 1e5 ? 5e3 : 1e4;
        await ogma.addGraph(articles, { batchSize });
      }

      setExpanding(false);
      ogma.events.once("idle", async () => {
        setLayoutBusy("force");
        await ogma.layouts.force({
          gpu: true,
          locate: true,
          onSync: () => setLayoutNotBusy("force"),
        });
      });
    };
    void get_articles();
  }, [
    ogma,
    selectedNode,
    setLayout,
    setExpandedClusters,
    day,
    cachedExpansion,
    getArticles,
    history,
    threats,
    augmentScale,
    setLayoutBusy,
    setLayoutNotBusy,
  ]);

  const handleTimeSeriesClick = useCallback(() => {
    if (!selectedNode?.node) return;
    const d = getNodeData(selectedNode.node);
    if (
      typeof locale === "string" &&
      typeof day === "string" &&
      d?.type === "cluster"
    ) {
      router.push(`/${locale}/${day}/${history}/${d.id}`);
    }
  }, [day, history, locale, router, selectedNode?.node]);

  const handleDataLoading = useCallback((loading: boolean) => {
    setDataLoading(loading);
  }, []);

  const handleEverythingChange = useCallback(() => {
    setEverything(!everything);
  }, [everything, setEverything]);

  const handleGroupByFeatureClick = useCallback(() => {
    setFeature_GroupArticleBy(!feature_GroupArticleBy);
  }, [feature_GroupArticleBy, setFeature_GroupArticleBy]);

  const handleReset = useCallback(() => {
    setFocus(null);
    refresh();
  }, [refresh, setFocus]);

  const handleLayoutClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, Event>) => {
      const l = e.currentTarget.getAttribute("data-layout");
      if (l === "hierarchical" && layout === l) toggleTreeDirection();
      if (
        l &&
        (l === "force" ||
          l === "hierarchical" ||
          l === "grid" ||
          l === "radial" ||
          l === "concentric")
      ) {
        setLayout(l);
        setFocus(null);
      }
    },
    [layout, setFocus, setLayout, toggleTreeDirection],
  );

  // Controls
  const [maximized, setMaximized] = useState(false);
  const [expanding, setExpanding] = useState(false);

  const handleGeoBtnClick = useCallback(() => {
    setGeoMode(!geoMode);
  }, [geoMode, setGeoMode]);

  const handleCollapseAllClick = useCallback(() => {
    setExpandedClusters([]);
    refresh();
  }, [refresh, setExpandedClusters]);

  const handleMaximizeClick = useCallback(() => {
    setMaximized(!maximized);
  }, [maximized]);

  const handleMapModeChange = useCallback(
    (
      event: SelectChangeEvent<
        "open" | "roadmap" | "satellite" | "terrain" | "hybrid"
      >,
    ) => {
      const v = event.target.value;
      if (
        v === "open" ||
        v === "roadmap" ||
        v === "terrain" ||
        v === "hybrid" ||
        v === "satellite"
      )
        setMapMode(v);
    },
    [setMapMode],
  );

  const handleSatelliteClick = useCallback(() => {
    setMapMode(mapMode === "roadmap" ? "hybrid" : "roadmap");
  }, [mapMode, setMapMode]);

  const resizeOgma = useDebounceCallback(
    (ogma: OgmaLib, max: boolean, w: number, h: number) => {
      const currentSize = ogma.view.getSize();
      if (
        max &&
        (currentSize.height !== window.innerHeight ||
          currentSize.width !== window.innerWidth)
      ) {
        void ogma.view.setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      } else if (currentSize.width !== w || currentSize.height !== h) {
        const resize = async () => {
          await ogma.view.setSize({ width: w, height: h });
          if (ogma.geo.enabled()) {
            const view = ogma.geo.getView();
            await ogma.geo.disable({ duration: 0 });
            await ogma.geo.enable({ duration: 0 });
            if (view)
              await ogma.geo.setView(view.latitude, view.longitude, view.zoom);
          } else {
            await ogma.view.locateGraph();
          }
        };
        void resize();
      }
    },
  );

  useEffect(() => {
    const loadGoogleMaps = async () => {
      const loader = new Loader({
        apiKey: env.NEXT_PUBLIC_GOOGLE_API_KEY,
      });

      await loader.importLibrary("maps");
    };
    void loadGoogleMaps();
  }, []);

  useEffect(() => {
    if (ogmaRef.current && ogmaHoverContainerRef.current) {
      if (geoMode) {
        ogmaRef.current.geo
          .getMap()
          ?.getContainer()
          .appendChild(ogmaHoverContainerRef.current);
      } else {
        ogmaHoverContainerRef.current.classList.add("hidden");
        void ogmaHoverRef.current?.clearGraph();
        ogmaParentContainer.current?.appendChild(ogmaHoverContainerRef.current);
      }
    }
  }, [geoMode]);

  useEffect(() => {
    if (!ogmaRef.current) return;
    if (maximized) {
      resizeOgma(ogmaRef.current, true, window.innerWidth, window.innerHeight);
    } else if (width && height) {
      resizeOgma(ogmaRef.current, false, width, height);
    }
  }, [height, width, maximized, resizeOgma]);

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

  const layouts: [LayoutModes, JSX.Element, boolean][] = useMemo(() => {
    return [
      ["force", <Workflow size={22} key="force" />, layoutBusy.length === 0],
      [
        "hierarchical",
        <Waypoints size={22} key="waypoints" />,
        layoutBusy.length === 0 && !everything,
      ],
      ["grid", <Grip size={22} key="grid" />, layoutBusy.length === 0],
      [
        "radial",
        <Diameter size={22} key="radial" />,
        layoutBusy.length === 0 && Boolean(selectedNode?.node),
      ],
      [
        "concentric",
        <CircleDot size={22} key="concentric" />,
        layoutBusy.length === 0 && Boolean(selectedNode?.node),
      ],
    ];
  }, [everything, selectedNode, layoutBusy]);

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

      <Panel className="flex flex-col" order={2}>
        <div className="relative w-full flex-1" ref={ref}>
          <div
            className="absolute h-full max-h-full w-full max-w-full"
            ref={ogmaParentContainer}
          >
            <Ogma
              // key={`ogma-${day}-${history}`}
              ref={ogmaRef}
              onReady={(ogma) => {
                setOgma(ogma);
                ogma.events
                  .on("mouseover", async ({ target }) => {
                    if (
                      !target ||
                      !target.isNode ||
                      !target.isVirtual() ||
                      !ogmaHoverContainerRef.current ||
                      !ogmaHoverRef.current
                    )
                      return;
                    const subNodes = target.getSubNodes()!;
                    if (subNodes?.size <= 1) {
                      ogmaHoverContainerRef.current?.classList.add("hidden");
                      return;
                    }
                    const subEdges = subNodes?.getAdjacentEdges({
                      filter: "all",
                      bothExtremities: true,
                    });
                    ogmaHoverContainerRef.current.classList.remove("hidden");
                    if (subNodes) {
                      const { x, y } = target.getPositionOnScreen();
                      ogmaHoverContainerRef.current.style.left = `${x + 50}px`;
                      ogmaHoverContainerRef.current.style.top = `${y}px`;
                      await ogmaHoverRef.current.setGraph({
                        nodes: subNodes.toJSON(),
                        edges: subEdges.toJSON(),
                      });
                      await ogmaHoverRef.current.layouts.force({
                        gpu: true,
                        locate: true,
                        duration: 0,
                      });
                    }
                  })
                  .on(["click", "dragStart", "viewChanged"], () => {
                    ogmaHoverContainerRef.current?.classList.add("hidden");
                  });
              }}
            >
              <DataLoader day={parseInt(day)} onLoading={handleDataLoading} />

              <NodeFilter
                enabled
                criteria={(n) => {
                  if (everything) return true;
                  const data = getNodeData(n);
                  if (data?.type === "article") {
                    const cluster_id = n.getData("cluster_id") as string;
                    if (expandedClusters.includes(cluster_id)) return true;
                    return false;
                  }
                  return true;
                }}
              />
              <Styles fullScreen={maximized} />
              <Interactions />
              <LayoutService
                ref={layoutService}
                threats={threats}
                dataLoaded={dataLoading}
                fullScreen={maximized}
                onExitFullScreen={handleMaximizeClick}
              />
              {clusterId && <TimeLine container={timelineRef} />}
              <LocationTransforms />
              <>
                <div className="control-buttons">
                  <div className="flex space-x-[8px]">
                    {rodMode && (
                      <FormGroup className="border bg-white p-5">
                        <FormLabel sx={{ fontWeight: "bold", fontSize: 16 }}>
                          Rod Mode
                        </FormLabel>
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="large"
                              checked={everything}
                              onChange={handleEverythingChange}
                              disabled={geoMode}
                            />
                          }
                          label={
                            <span style={{ fontSize: 14 }}>Fetch All</span>
                          }
                        />
                        <FormControlLabel
                          control={
                            <Checkbox
                              size="large"
                              checked={feature_GroupArticleBy}
                              onChange={handleGroupByFeatureClick}
                            />
                          }
                          label={
                            <span style={{ fontSize: 14 }}>
                              Feature Flag: Group Articles by...
                            </span>
                          }
                        />
                        <FormControl variant="standard">
                          <InputLabel sx={{ fontSize: 14 }}>
                            Map Mode
                          </InputLabel>
                          <Select
                            labelId="demo-simple-select-standard-label"
                            id="demo-simple-select-standard"
                            value={mapMode}
                            onChange={handleMapModeChange}
                            label="Map Mode"
                            sx={{ fontSize: 14 }}
                          >
                            <MenuItem value="open" sx={{ fontSize: 14 }}>
                              OpenStreet
                            </MenuItem>
                            <MenuItem value="terrain" sx={{ fontSize: 14 }}>
                              Google Terrain
                            </MenuItem>
                            <MenuItem value="hybrid" sx={{ fontSize: 14 }}>
                              Google Hybrid
                            </MenuItem>
                            <MenuItem value="satellite" sx={{ fontSize: 14 }}>
                              Google Satellite
                            </MenuItem>
                            <MenuItem value="roadmap" sx={{ fontSize: 14 }}>
                              Google Roadmap
                            </MenuItem>
                          </Select>
                        </FormControl>

                        <Button
                          onClick={handleTimeSeriesClick}
                          disabled={
                            selectedNode?.node.getData("type") !== "cluster" ||
                            true
                          }
                          variant="contained"
                          sx={{ fontSize: 14, marginTop: 1 }}
                        >
                          Time Series
                        </Button>
                      </FormGroup>
                    )}
                    {!geoMode && (
                      <>
                        <ButtonGroup>
                          <IconButton
                            className="foresight-graph-btn"
                            title={t("resetLayout")}
                            onClick={handleReset}
                          >
                            <RefreshCcw size={22} />
                          </IconButton>
                          <IconButton
                            className={`foresight-graph-btn${expanding ? " disabled" : ""}`}
                            disabled={expanding}
                            title={t("expandArticles", {
                              type: selectedNode?.node.getData(
                                "type",
                              ) as string,
                            })}
                            onClick={handleExpandRelatedClusters}
                          >
                            {expanding && (
                              <FontAwesomeIcon icon={faSpinner} spin />
                            )}
                            {!expanding && <FileSearch size={22} />}
                          </IconButton>
                          <IconButton
                            className="foresight-graph-btn"
                            onClick={handleCollapseAllClick}
                            title={t("collapseArticles")}
                          >
                            <FileX2 size={22} />
                          </IconButton>
                        </ButtonGroup>
                        <ButtonGroup>
                          {layouts.map(([l, icon, enabled]) => (
                            <IconButton
                              key={`layout${l}`}
                              className={`foresight-graph-btn${layout === l ? " active" : ""}${!enabled ? " disabled" : ""}`}
                              data-layout={l}
                              disabled={!enabled}
                              onClick={handleLayoutClick}
                              title={t("layoutNodes", { layout: l })}
                            >
                              {layoutBusy.includes(l) ? (
                                <FontAwesomeIcon icon={faSpinner} spin />
                              ) : (
                                icon
                              )}
                            </IconButton>
                          ))}
                        </ButtonGroup>
                      </>
                    )}
                    {geoMode && (
                      <IconButton
                        className={`foresight-graph-btn${mapMode === "hybrid" ? " active" : ""}`}
                        onClick={handleSatelliteClick}
                        title={t("satelliteToggle")}
                      >
                        <Satellite size={22} />
                      </IconButton>
                    )}
                    <IconButton
                      className="foresight-graph-btn"
                      onClick={handleGeoBtnClick}
                      title={t("mapView")}
                    >
                      <Map size={22} />
                    </IconButton>
                    <IconButton
                      className="foresight-graph-btn"
                      onClick={handleMaximizeClick}
                      title={t("fullScreen")}
                    >
                      {!maximized && <Maximize2 size={22} />}
                      {maximized && <Minimize2 size={22} />}
                    </IconButton>
                  </div>
                </div>
              </>
            </Ogma>
            <div ref={ogmaHoverContainerRef} className="hoverogma hidden">
              <Ogma
                ref={ogmaHoverRef}
                options={{
                  width: 150,
                  height: 150,
                  backgroundColor: "rgba(250,250,250,0.75)",
                }}
              >
                <Styles />
                <LayoutService
                  threats={threats}
                  dataLoaded={dataLoading}
                  fullScreen={false}
                  hover={true}
                />
              </Ogma>
            </div>
            {clusterId && (
              <div className="" id="timeline" ref={timelineRef}></div>
            )}
          </div>
        </div>
        {/* <div className="h-[256px]"></div> */}
      </Panel>
    </PanelGroup>
  );
}
