import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  type CanvasLayer,
  type NodesEvent,
  type Node as OgmaNode,
} from "@linkurious/ogma";
import { useOgma } from "@linkurious/ogma-react";

import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import Checkbox from "@mui/material/Checkbox";
import Select, { type SelectChangeEvent } from "@mui/material/Select";

import {
  CircleDot,
  Diameter,
  FileSearch,
  FileX2,
  Grip,
  Heater,
  Map,
  Maximize2,
  Minimize2,
  RefreshCcw,
  Satellite,
  ScanSearch,
  Waypoints,
  Workflow,
} from "lucide-react";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import IconButton from "@mui/material/IconButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  applyLayout,
  findAlongPath,
  getNodeData,
  heatMap,
} from "~/app/_utils/graph";

import { type LayoutModes, useStore } from "~/app/_store";
import { api } from "~/trpc/react";

export default function Controls() {
  const getArticles = api.post.getArticles.useMutation();

  const {
    rodMode,
    mapMode,
    everything,
    history,
    feature_GroupArticleBy,
    setFeature_GroupArticleBy,
    feature_Timeline,
    setFeature_Timeline,
    setEverything,
    setFocus,
    setMapMode,
    refresh,
    include_articles,
    setIncludeArticles,
    feature_workbench,
    setFeature_Workbench,
  } = useStore();

  const { day, locale } = useParams();
  const router = useRouter();

  const t = useTranslations();

  const [expanding, setExpanding] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [geoMode, setGeoMode] = useState(false);
  const [layout, setLayout] = useState<LayoutModes>("force");
  const [layoutBusy, setLayoutBusy] = useState<LayoutModes[]>([]);
  const [treeDirection, setTreeDirection] = useState<"BT" | "TB" | "LR" | "RL">(
    "BT",
  );
  const [selectedNode, setSelectedNode] = useState<OgmaNode | null>(null);
  const [heatMapCanvas, setHeatMapCanvas] = useState<CanvasLayer | null>(null);

  const ogma = useOgma();

  useEffect(() => {
    const auto_expand = localStorage.getItem("include_articles");
    setIncludeArticles(auto_expand === "true");
  }, [setIncludeArticles]);

  useEffect(() => {
    const handleSelectNode = (evt: NodesEvent<unknown, unknown>) => {
      if (evt.nodes.size === 1) {
        setSelectedNode(evt.nodes.get(0));
      } else setSelectedNode(null);
    };
    const handleUnSelectNode = () => {
      setSelectedNode(null);
    };
    const handleGeoModeEnabled = () => {
      setGeoMode(true);
    };
    const handleGeoModeDisabled = () => {
      setGeoMode(false);
    };
    ogma.events.on("nodesSelected", handleSelectNode);
    ogma.events.on("nodesUnselected", handleUnSelectNode);
    ogma.events.on("geoEnabled", handleGeoModeEnabled);
    ogma.events.on("geoDisabled", handleGeoModeDisabled);
    return () => {
      ogma.events.off(handleSelectNode);
      ogma.events.off(handleUnSelectNode);
      ogma.events.off(handleGeoModeDisabled);
      ogma.events.off(handleGeoModeEnabled);
    };
  }, [ogma.events]);

  const onLayoutStart = useCallback(
    (l: LayoutModes) => () => setLayoutBusy(layoutBusy.concat(l)),
    [layoutBusy],
  );
  const onLayoutEnd = useCallback(
    (l: LayoutModes) => () => setLayoutBusy(layoutBusy.filter((m) => m === l)),
    [layoutBusy],
  );

  const handleHeatMap = useCallback(() => {
    if (heatMapCanvas) {
      heatMapCanvas.destroy();
      setHeatMapCanvas(null);
    } else setHeatMapCanvas(heatMap(ogma));
  }, [heatMapCanvas, ogma]);

  const handleExpandRelatedClusters = useCallback(() => {
    const clusters =
      selectedNode?.getData("type") === "hierarchicalcluster"
        ? findAlongPath(
            selectedNode,
            "out",
            (n) => n.getData("type") === "cluster",
          )
        : ogma.getNodes().filter((n) => getNodeData(n)?.type === "cluster");
    if (clusters.size === 0) return;
    setExpanding(true);
    setLayout("force");

    const get_articles = async () => {
      if (typeof day !== "string") return;
      const articles = await getArticles.mutateAsync({
        clusters: clusters.map((c) => c.getData("id") as string),
      });
      const batchSize = articles.nodes.length < 1e5 ? 5e3 : 1e4;
      await ogma.addGraph(articles, { batchSize });

      setExpanding(false);

      ogma.events.once("idle", async () => {
        await applyLayout({
          ogma,
          layout: "force",
          onLayoutStart: onLayoutStart("force"),
          onLayoutEnd: onLayoutEnd("force"),
        });
      });
    };
    void get_articles();
  }, [selectedNode, ogma, day, getArticles, onLayoutStart, onLayoutEnd]);

  const handleTimeSeriesClick = useCallback(() => {
    if (!selectedNode) return;
    const d = getNodeData(selectedNode);
    if (
      typeof locale === "string" &&
      typeof day === "string" &&
      d?.type === "cluster"
    ) {
      router.push(`/${locale}/${day}/${history}/${d.id}`);
    }
  }, [day, history, locale, router, selectedNode]);

  const handleResetTour = useCallback(() => {
    localStorage.removeItem("visited");
    alert("Done.");
  }, []);

  const handleEverythingChange = useCallback(() => {
    setEverything(!everything);
  }, [everything, setEverything]);

  const handleWorkbenchChange = useCallback(() => {
    setFeature_Workbench(!feature_workbench);
  }, [feature_workbench, setFeature_Workbench]);

  const handleGroupByFeatureClick = useCallback(() => {
    setFeature_GroupArticleBy(!feature_GroupArticleBy);
  }, [feature_GroupArticleBy, setFeature_GroupArticleBy]);

  const handleTimelineFeatureClick = useCallback(() => {
    setFeature_Timeline(!feature_Timeline);
  }, [feature_Timeline, setFeature_Timeline]);

  const handleReset = useCallback(() => {
    setFocus(null);
    refresh();
  }, [refresh, setFocus]);

  const handleLayoutClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, Event>) => {
      const l = e.currentTarget.getAttribute("data-layout") as
        | "force"
        | "grid"
        | "hierarchical"
        | "radial"
        | "concentric"
        | undefined;
      if (
        !l &&
        l !== "force" &&
        l !== "grid" &&
        l !== "hierarchical" &&
        l !== "radial" &&
        l !== "concentric"
      )
        return;
      setLayout(l);

      if (l === "force" || l === "grid") {
        void applyLayout({
          layout: l,
          ogma,
          onLayoutStart: onLayoutStart(l),
          onLayoutEnd: onLayoutEnd(l),
        });
      } else if (l === "hierarchical") {
        const direction =
          layout === "hierarchical"
            ? treeDirection === "LR"
              ? "TB"
              : treeDirection === "TB"
                ? "RL"
                : treeDirection === "RL"
                  ? "BT"
                  : "LR"
            : treeDirection;
        setTreeDirection(direction);
        void applyLayout({
          layout: l,
          ogma,
          direction,
          onLayoutStart: onLayoutStart(l),
          onLayoutEnd: onLayoutEnd(l),
        });
      } else if (selectedNode && (l === "radial" || l === "concentric")) {
        void applyLayout({
          ogma,
          layout: l,
          centralNode: selectedNode,
          onLayoutStart: onLayoutStart(l),
          onLayoutEnd: onLayoutEnd(l),
        });
      }
    },
    [layout, ogma, onLayoutEnd, onLayoutStart, selectedNode, treeDirection],
  );

  const handleGeoBtnClick = useCallback(async () => {
    if (!ogma.geo.enabled()) {
      await ogma.geo.enable({
        longitudePath: "location.longitude",
        latitudePath: "location.latitude",
        minZoomLevel: 2,
        maxZoomLevel: 10,
        sizeRatio: 0.8,
      });
    } else {
      await ogma.geo.disable();
    }
  }, [ogma.geo]);

  const handleToggleAutoExpand = useCallback(() => {
    setIncludeArticles(!include_articles);
    localStorage.setItem("include_articles", JSON.stringify(!include_articles));
  }, [include_articles, setIncludeArticles]);

  const handleCollapseAllClick = useCallback(async () => {
    await ogma.removeNodes(
      ogma.getNodes().filter((n) => n.getData("type") === "article"),
    );
    if (layout === "force" || layout === "grid") {
      await applyLayout({ ogma, layout });
    } else if (layout === "radial" || layout === "concentric") {
      if (selectedNode)
        await applyLayout({ ogma, layout, centralNode: selectedNode });
    } else {
      await applyLayout({ ogma, layout, direction: treeDirection });
    }
  }, [layout, ogma, selectedNode, treeDirection]);

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

  const handleMaximizeClick = useCallback(() => {
    setMaximized(!maximized);
    void ogma?.view.setFullScreen(!maximized);

    if (!maximized) {
      const pollFullscreen = () => {
        setTimeout(() => {
          if (!ogma.view.isFullScreen()) {
            setMaximized(false);
          } else pollFullscreen();
        }, 200);
      };
      pollFullscreen();
    }
  }, [maximized, ogma]);

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
        layoutBusy.length === 0 && Boolean(selectedNode),
      ],
      [
        "concentric",
        <CircleDot size={22} key="concentric" />,
        layoutBusy.length === 0 && Boolean(selectedNode),
      ],
    ];
  }, [everything, selectedNode, layoutBusy]);

  return (
    <div className="control-buttons">
      <div className="flex space-x-[8px]">
        {rodMode && (
          <FormGroup className="border bg-white p-5">
            <FormLabel sx={{ fontWeight: "bold", fontSize: 16 }}>
              Rod Mode
            </FormLabel>
            <Button variant="contained" onClick={handleResetTour}>
              Reset Tour First Visit
            </Button>
            <FormControlLabel
              control={
                <Checkbox
                  size="large"
                  checked={feature_workbench}
                  onChange={handleWorkbenchChange}
                />
              }
              label={<span style={{ fontSize: 14 }}>Workbench</span>}
            />

            <FormControlLabel
              control={
                <Checkbox
                  size="large"
                  checked={everything}
                  onChange={handleEverythingChange}
                  disabled={geoMode}
                />
              }
              label={<span style={{ fontSize: 14 }}>Fetch All</span>}
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
            <FormControlLabel
              control={
                <Checkbox
                  size="large"
                  checked={feature_Timeline}
                  onChange={handleTimelineFeatureClick}
                />
              }
              label={
                <span style={{ fontSize: 14 }}>
                  Feature Flag: Switch to top 5 cluster timeline view
                </span>
              }
            />
            <FormControl variant="standard">
              <InputLabel sx={{ fontSize: 14 }}>Map Mode</InputLabel>
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
              disabled={selectedNode?.getData("type") !== "cluster" || true}
              variant="contained"
              sx={{ fontSize: 14, marginTop: 1 }}
            >
              Time Series
            </Button>
          </FormGroup>
        )}
        {!geoMode && (
          <>
            <IconButton
              className="sdp-refresh foresight-graph-btn"
              title={t("resetLayout")}
              onClick={handleReset}
            >
              <RefreshCcw size={22} />
            </IconButton>
            <IconButton
              className={`sdp-heatmap foresight-graph-btn${heatMapCanvas ? " active" : ""} ${!Boolean(history) ? " disabled" : ""}`}
              title="Heatmap"
              disabled={!Boolean(history)}
              onClick={handleHeatMap}
            >
              <Heater size={22} />
            </IconButton>
            <ButtonGroup className="sdp-collapse-expand">
              <IconButton
                className={`sdp-expand foresight-graph-btn${expanding ? " disabled" : ""}`}
                disabled={expanding}
                title={t("expandArticles", {
                  type: selectedNode?.getData("type") as string,
                })}
                onClick={handleExpandRelatedClusters}
              >
                {expanding && <FontAwesomeIcon icon={faSpinner} spin />}
                {!expanding && <FileSearch size={22} />}
              </IconButton>
              <IconButton
                className="foresight-graph-btn sdp-collapse"
                onClick={handleCollapseAllClick}
                title={t("collapseArticles")}
              >
                <FileX2 size={22} />
              </IconButton>
              <IconButton
                className={`foresight-graph-btn ${include_articles ? " active " : ""}`}
                onClick={handleToggleAutoExpand}
                title={t("toggleAutoExpand")}
              >
                <ScanSearch size={22} />
              </IconButton>
            </ButtonGroup>
            <ButtonGroup className="sdp-layout-algorithms">
              {layouts.map(([l, icon, enabled]) => (
                <IconButton
                  key={`layout${l}`}
                  className={`sdp-layout-${l} foresight-graph-btn${layout === l ? " active" : ""}${!enabled ? " disabled" : ""}`}
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
          className="sdp-geomode foresight-graph-btn"
          property={geoMode ? "geoActive" : "geoInactive"}
          onClick={handleGeoBtnClick}
          title={t("mapView")}
        >
          <Map size={22} />
        </IconButton>
        <IconButton
          className="sdp-fullscreen foresight-graph-btn"
          onClick={handleMaximizeClick}
          title={t("fullScreen")}
        >
          {!maximized && <Maximize2 size={22} />}
          {maximized && <Minimize2 size={22} />}
        </IconButton>
      </div>
    </div>
  );
}
