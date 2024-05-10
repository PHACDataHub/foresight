"use client";

import Button from "@mui/material/Button";
import { useParams, useRouter } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Joyride, {
  ACTIONS,
  type CallBackProps,
  EVENTS,
  STATUS,
  type Styles,
} from "react-joyride";
import { useTranslations } from "next-intl";
import { type SelectedNode, useStore } from "~/app/_store";

import { clusterExpandToggle } from "~/app/_utils/graph";
import { api } from "~/trpc/react";
import JoyrideLocales from "./locale";

import standardTourFactory from "./StandardTour";

const tf = standardTourFactory({
  Welcome: {
    step: {
      target: "body",
      placement: "center",
      styles: { options: { width: "50vw" } },
    },
  },
  SidePanel: { step: { target: ".sdp-sidepanel", placement: "right" } },
  SearchAndFilter: { step: { target: ".sdp-search-filter" } },
  KeywordSearch: { step: { target: ".sdp-hightlight-terms" } },
  KeywordSearchBoolean: { step: { target: ".sdp-term-boolean" } },
  DatePicker: { step: { target: ".sdp-timetravel" } },
  History: { step: { target: ".sdp-history-chooser" } },
  TotalArticleAndRelevantItems: { step: { target: ".sdp-count-filter" } },
  FilterViewIntro: { step: { target: ".sdp-threat-sel" } },
  FilterViewSelectThreat: {
    step: {
      target: ".sdp-threat-sel-list",
      placement: "left",
    },
  },
  ClusterGraph: {
    step: { target: ".sdp-graph-panel", styles: { tooltip: { width: 900 } } },
    image: { src: "/node_colours.png", height: 605, width: 1366 },
  },
  GraphViews: { step: { target: ".control-buttons" } },
  Refresh: { step: { target: ".sdp-refresh" } },
  HeatMap: { step: { target: ".sdp-heatmap" } },
  CollapseAllIntro: { step: { target: ".sdp-collapse-expand" } },
  CollapseAll: { step: { target: ".sdp-collapse" } },
  LayoutAlgorithms: { step: { target: ".sdp-layout-algorithms" } },
  HierarchicalView: { step: { target: ".sdp-layout-hierarchical" } },
  GeoMode: { step: { target: ".sdp-geomode" } },
  FullScreen: { step: { target: ".sdp-fullscreen" } },
  ArticleClusters: {
    step: {
      target: ".sdp-locate-btn",
      placement: "right",
      disableScrolling: true,
    },
  },
  ExpandClusterIntro: {
    step: {
      target: ".sdp-graph-panel",
      placement: "left",
    },
  },
  ExpandCluster: { step: { target: ".sdp-graph-panel", placement: "left" } },
  ClusterGrowth: {
    step: {
      target: ".sdp-cluster-growth",
      placement: "top",
    },
  },
  SelectedClusterIntro: {
    step: {
      target: ".sdp-sidepanel",
      placement: "right",
    },
  },
  ChatConsole: { step: { target: ".sdp-chat-console" } },
  Feedback: { step: { target: ".product-feedback" } },
  EndOfTour: { step: { target: ".product-tour" } },
});

const containedStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  boxSizing: "border-box",
  outline: 0,
  border: 0,
  margin: 0,
  cursor: "pointer",
  userSelect: "none",
  verticalAlign: "middle",
  textDecoration: "none",
  fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
  fontWeight: 500,
  lineHeight: 1.75,
  letterSpacing: "0.02857em",
  textTransform: "uppercase",
  minWidth: 64,
  padding: "6px 16px",
  borderRadius: 4,
  transition:
    "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
  color: "#fff",
  backgroundColor: "#1976d2",
  boxShadow:
    "0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)",
  fontSize: 14,
};

const textStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  boxSizing: "border-box",
  backgroundColor: "transparent",
  outline: 0,
  border: 0,
  margin: 0,
  cursor: "pointer",
  userSelect: "none",
  verticalAlign: "middle",
  textDecoration: "none",
  fontFamily: '"Roboto","Helvetica","Arial",sans-serif',
  fontWeight: 500,
  lineHeight: 1.75,
  letterSpacing: "0.02857em",
  textTransform: "uppercase",
  minWidth: "64px",
  padding: "6px 8px",
  borderRadius: 4,
  transition:
    "background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,border-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
  color: "#1976d2",
  fontSize: 14,
};

const joyrideStyles: Partial<Styles> = {
  options: { zIndex: 10000 },
  buttonNext: containedStyle,
  buttonSkip: textStyle,
  buttonBack: textStyle,
};

export default function ProductTour() {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const {
    threats,
    expandedClusters,
    toggleExpandedCluster,
    setLayoutBusy,
    setLayoutNotBusy,
    setThreats,
    selectedNode,
    setSelectedNode,
    setSearchTerms,
    setShowInfoPanel,
  } = useStore();
  const { locale } = useParams();
  const t = useTranslations("ProductTour");
  const router = useRouter();
  const cluster = api.post.cluster.useMutation();

  const selectedNodeRef = useRef<SelectedNode | null>(null);

  const steps = useMemo(() => tf.steps(), []);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    const visited = localStorage.getItem("visited");
    if (!visited) {
      setRun(true);
      setStepIndex(0);
      localStorage.setItem("visited", "yes");
    }
  }, []);

  const label = useMemo(() => t("tour"), [t]);

  const resetTour = useCallback(() => {
    const l = typeof locale === "string" ? locale : "en-CA";
    setStepIndex(0);
    setSelectedNode(null);
    setShowInfoPanel(true);
    router.push(`/${l}/1`);
    setSearchTerms([]);
    const el = document.querySelector<HTMLButtonElement>(
      "button[property=geoActive]",
    );
    if (el) {
      el.click();
    }
  }, [locale, router, setSearchTerms, setSelectedNode, setShowInfoPanel]);

  const handleTourClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      evt.preventDefault();
      resetTour();
      setRun(true);
    },
    [resetTour],
  );

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;
      const l = typeof locale === "string" ? locale : "en-CA";

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const n = index + (action === ACTIONS.PREV ? -1 : 1);
        setStepIndex(n);

        tf.stepMachine(index, action === ACTIONS.PREV ? "backward" : "forward")
          .into("KeywordSearch", () => setSearchTerms([]))
          .forwardOutOf("KeywordSearch", () => setSearchTerms(["pneumonia"]))
          .into("DatePicker", () => router.push(`/${l}/1`))
          .forwardOutOf("DatePicker", () => router.push(`/${l}/39`))
          .into("History", () => router.push(`/${l}/39`))
          .forwardOutOf("History", () => router.push(`/${l}/39/3`))
          .into("FilterViewSelectThreat", () => {
            setThreats(
              threats.filter((t) => t !== "Unrecognized health risks"),
            );
            const el = document.querySelector<HTMLButtonElement>(
              ".sdp-threat-sel > button",
            );
            if (el) el.click();
          })
          .forwardOutOf("FilterViewSelectThreat", () => {
            setThreats(threats.concat(["Unrecognized health risks"]));
          })
          .outOf("FilterViewSelectThreat", () => {
            const el = document.querySelector<HTMLButtonElement>(
              ".sdp-threat-sel > button",
            );
            if (el) el.click();
          })
          .into("HeatMap", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-heatmap");
            if (el) el.click();
          })
          .outOf("HeatMap", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-heatmap");
            if (el) el.click();
          })
          .into("HierarchicalView", () => {
            const el = document.querySelector<HTMLButtonElement>(
              ".sdp-layout-hierarchical",
            );
            if (el) el.click();
          })
          .outOf("HierarchicalView", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-layout-force");
            if (el) el.click();
          })
          .into("CollapseAll", () => {
            const el = document.querySelector<HTMLButtonElement>(".sdp-expand");
            if (el) el.click();
          })
          .forwardOutOf("CollapseAll", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-collapse");
            if (el) el.click();
          })
          .into("ArticleClusters", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-refresh");
            if (el) el.click();
          })
          .forwardOutOf("ArticleClusters", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-locate-btn");
            if (el) el.click();
          })
          .backwardInto("ExpandClusterIntro", () => {
            const el =
              document.querySelector<HTMLButtonElement>(".sdp-collapse");
            if (el) el.click();
            setSelectedNode(null);
          })
          .forwardOutOf("ExpandClusterIntro", () => {
            const el = document.querySelectorAll<HTMLButtonElement>(
              ".sdp-select-node-btn",
            );
            if (el[1]) {
              el[1].click();
            }

            const waitForSelection = () => {
              if (selectedNodeRef.current?.node) {
                clusterExpandToggle(
                  selectedNodeRef.current.node,
                  selectedNodeRef.current.ogma,
                  expandedClusters,
                  toggleExpandedCluster,
                  async (id) => {
                    return await cluster.mutateAsync({ id });
                  },
                  setLayoutBusy,
                  setLayoutNotBusy,
                );
                const el =
                  document.querySelector<HTMLButtonElement>(".sdp-summary-tab");
                if (el) el.click();
              } else setTimeout(waitForSelection, 300);
            };
            // setStepIndex(n - 1);
            waitForSelection();
          });

        // if (tf.isStepInto("ExpandClusterIntro", n)) {
        // }
      } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        setRun(false);
        resetTour();
      }
    },
    [
      cluster,
      expandedClusters,
      locale,
      resetTour,
      router,
      setLayoutBusy,
      setLayoutNotBusy,
      setSearchTerms,
      setSelectedNode,
      setThreats,
      threats,
      toggleExpandedCluster,
    ],
  );

  return (
    <li className="product-tour">
      <Button href="#" onClick={handleTourClick} data-touring={run}>
        {label}
      </Button>
      <Joyride
        continuous
        locale={JoyrideLocales}
        callback={handleJoyrideCallback}
        run={run}
        stepIndex={stepIndex}
        scrollToFirstStep
        disableCloseOnEsc
        disableOverlayClose
        hideCloseButton
        showProgress
        showSkipButton
        steps={steps}
        styles={joyrideStyles}
      />
    </li>
  );
}
