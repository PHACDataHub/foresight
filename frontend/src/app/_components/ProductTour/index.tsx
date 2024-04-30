"use client";

import Link from "@mui/material/Link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import Joyride, {
  ACTIONS,
  type CallBackProps,
  EVENTS,
  STATUS,
  type Styles,
} from "react-joyride";
import { useTranslations } from "next-intl";
import { useStore } from "~/app/_store";

import locale from "./locale";

import standardTourFactory from "./StandardTour";

const tf = standardTourFactory();

const steps = [
  tf.create("Welcome", {
    target: "body",
    placement: "center",
    styles: { options: { width: "90vw" } },
  }),
  tf.create("SidePanel", { target: ".sdp-sidepanel", placement: "right" }),
  tf.create("SearchAndFilter", { target: ".sdp-search-filter" }),
  tf.create("KeywordSearch", { target: ".sdp-hightlight-terms" }, true),
  tf.create("DatePickerIntro", { target: ".sdp-timetravel" }, true),
  tf.create("DatePickerDate", { target: ".timeTravelCalendar" }, true),
  tf.create("FilterViewIntro", { target: ".sdp-count-filter" }, true),
  tf.create(
    "FilterViewSelectThreat",
    { target: ".sdp-threat-sel-list", placement: "left", hideFooter: false },
    true,
  ),
  tf.create(
    "FilterViewClose",
    { target: ".sdp-threat-sel", placement: "left" },
    true,
  ),
  tf.create("ClusterGraph", { target: ".sdp-graph-panel", placement: "left" }),
  tf.create("GraphViews", { target: ".control-buttons" }),
  tf.create("CollapseAllIntro", { target: ".sdp-refresh-collapse-expand" }),
  tf.create("CollapseAll", { target: ".sdp-collapse" }, true),
  tf.create(
    "ArticleClusters",
    { target: ".sdp-locate-btn", placement: "right" },
    true,
  ),
  tf.create(
    "ExpandClusterIntro",
    { target: ".sdp-graph-panel", placement: "left" },
    true,
  ),
  tf.create("ExpandCluster", { target: ".sdp-graph-panel", placement: "left" }),
  tf.create("SelectedClusterIntro", {
    target: ".sdp-sidepanel",
    placement: "right",
  }),
  tf.create("ChatConsole", { target: ".sdp-chat-console" }),
  tf.create("EndOfTour", { target: "#top-menu" }),
];

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
  fontSize: 18,
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
  fontSize: 18,
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
  const { threats, setThreats, searchTerms, selectedNode, setSearchTerms } =
    useStore();
  const { day } = useParams();
  const t = useTranslations("ProductTour");

  const label = useMemo(() => t("tour"), [t]);

  const handleTourClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      evt.preventDefault();
      setRun(true);
    },
    [],
  );

  useEffect(() => {
    if (run && stepIndex === tf.indexOf("KeywordSearch")) {
      if (searchTerms.includes("pneumonia")) {
        setStepIndex(tf.indexOf("DatePickerIntro"));
      }
    } else if (
      run &&
      stepIndex === tf.indexOf("DatePickerIntro") &&
      day !== "31"
    ) {
      let t: NodeJS.Timeout | null;
      const watchForPicker = () => {
        if (document.querySelector(".timeTravelCalendar")) {
          t = null;
          setStepIndex(tf.indexOf("DatePickerDate"));
        } else t = setTimeout(watchForPicker, 150);
      };
      watchForPicker();
      return () => {
        if (t) clearTimeout(t);
      };
    } else if (
      run &&
      (stepIndex === tf.indexOf("DatePickerDate") ||
        stepIndex === tf.indexOf("DatePickerIntro")) &&
      day === "31"
    ) {
      setStepIndex(tf.indexOf("FilterViewIntro"));
    } else if (run && stepIndex === tf.indexOf("FilterViewIntro")) {
      let t: NodeJS.Timeout | null;
      const watchForPicker = () => {
        if (document.querySelector(".sdp-threat-sel-list")) {
          t = null;
          setStepIndex(tf.indexOf("FilterViewSelectThreat"));
        } else t = setTimeout(watchForPicker, 150);
      };
      watchForPicker();
      return () => {
        if (t) clearTimeout(t);
      };
    } else if (
      run &&
      stepIndex === tf.indexOf("FilterViewSelectThreat") &&
      threats.includes("Unrecognized health risks")
    ) {
      setStepIndex(tf.indexOf("FilterViewClose"));
    } else if (run && stepIndex === tf.indexOf("FilterViewClose")) {
      let t: NodeJS.Timeout | null;
      const watchForPicker = () => {
        if (!document.querySelector(".sdp-threat-sel-list")) {
          t = null;
          setStepIndex(tf.indexOf("ClusterGraph"));
        } else t = setTimeout(watchForPicker, 150);
      };
      watchForPicker();
      return () => {
        if (t) clearTimeout(t);
      };
    } else if (run && stepIndex === tf.indexOf("CollapseAll")) {
      const clickHandler = () => {
        setStepIndex(tf.indexOf("ArticleClusters"));
      };
      document
        .querySelector(".sdp-collapse")
        ?.addEventListener("click", clickHandler);
      return () => {
        document
          .querySelector(".sdp-collapse")
          ?.removeEventListener("click", clickHandler);
      };
    } else if (run && stepIndex === tf.indexOf("ArticleClusters")) {
      const clickHandler = () => {
        setStepIndex(tf.indexOf("ExpandClusterIntro"));
      };
      document
        .querySelector(".sdp-locate-btn")
        ?.addEventListener("click", clickHandler);
      return () => {
        document
          .querySelector(".sdp-locate-btn")
          ?.removeEventListener("click", clickHandler);
      };
    } else if (
      run &&
      stepIndex === tf.indexOf("ExpandClusterIntro") &&
      selectedNode?.node
    ) {
      let t: NodeJS.Timeout | null;
      const watchForPicker = () => {
        if (
          selectedNode?.node
            .getAdjacentNodes()
            .filter((n) => n.getData("type") === "article").size > 0
        ) {
          t = null;
          setStepIndex(tf.indexOf("ExpandCluster"));
        } else t = setTimeout(watchForPicker, 150);
      };
      watchForPicker();
      return () => {
        if (t) clearTimeout(t);
      };
    }
  }, [day, run, stepIndex, searchTerms, threats, selectedNode?.node]);

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { action, index, status, type } = data;

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const n = index + (action === ACTIONS.PREV ? -1 : 1);
        setStepIndex(n);
        if (
          index === tf.indexOf("KeywordSearch") &&
          n === index + 1 &&
          !searchTerms.includes("pneumonia")
        ) {
          setSearchTerms(searchTerms.concat(["pneumonia"]));
        } else if (
          index === tf.indexOf("FilterViewSelectThreat") &&
          n === index + 1 &&
          !threats.includes("Unrecognized health risks")
        ) {
          setThreats(threats.concat(["Unrecognized health risks"]));
        }
      } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        // You need to set our running state to false, so we can restart if we click start again.
        setRun(false);
      }
    },
    [searchTerms, setSearchTerms, setThreats, threats],
  );

  return (
    <li>
      <Link href="#" onClick={handleTourClick}>
        {label}
        <Joyride
          continuous
          locale={locale}
          callback={handleJoyrideCallback}
          run={run}
          stepIndex={stepIndex}
          scrollToFirstStep
          hideBackButton
          showProgress
          showSkipButton
          steps={steps}
          styles={joyrideStyles}
        />
      </Link>
    </li>
  );
}
