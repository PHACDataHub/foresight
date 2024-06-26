"use client";

import React, {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import "react-slide-out/lib/index.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleDown } from "@fortawesome/free-solid-svg-icons";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";
import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";
import HighlightTerms from "./HighlightTerms";

function HighlightSourceComponent() {
  const [open, setOpen] = useState(false);
  const {
    sourceHighlight: selected,
    addSourceToHighlight,
    removeSourceToHighlight,
    persona,
  } = useStore();
  const t = useTranslations();

  const { data: sources } = api.post.sources.useQuery(
    { persona },
    { enabled: persona === "tom", refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (open) {
      const onClose = () => {
        const el = document.querySelector("a[data-touring=true]");
        if (el) return;
        setOpen(false);
      };
      setTimeout(() => {
        window.addEventListener("click", onClose);
      }, 100);
      return () => {
        window.removeEventListener("click", onClose);
      };
    }
  }, [open]);

  const handleOpenClick = useCallback(() => {
    setOpen(!open);
  }, [open]);

  const handleCheckClick = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      (evt.target.checked ? addSourceToHighlight : removeSourceToHighlight)(
        evt.target.value,
      );
    },
    [addSourceToHighlight, removeSourceToHighlight],
  );

  const preventPropagation = useCallback(
    (e: React.MouseEvent<HTMLDivElement, Event>) => {
      e.stopPropagation();
    },
    [],
  );

  const handleGroupSelect = useCallback(() => {
    if (!sources) return;
    const m =
      selected.length === sources.length
        ? removeSourceToHighlight
        : addSourceToHighlight;
    sources.forEach((s) => m(s));
  }, [addSourceToHighlight, removeSourceToHighlight, selected.length, sources]);

  const groupSelectText = useMemo(() => {
    if (!sources || sources.length !== selected.length)
      return t("HighlightSource.selectall");
    return t("HighlightSource.selectnone");
  }, [sources, selected.length, t]);

  if (persona !== "tom") return <></>;

  return (
    <div className="sdp-threat-sel relative" onClick={preventPropagation}>
      <Button
        sx={{ fontSize: 14 }}
        className="whitespace-nowrap"
        variant="contained"
        endIcon={<FontAwesomeIcon icon={faAngleDown} />}
        onClick={handleOpenClick}
      >
        {t("HighlightSource.highlightSources")}
      </Button>
      {open && (
        <div className="sdp-threat-sel-list absolute right-0 z-[1402] flex w-[650px] flex-col rounded-lg  border-[2px] border-gray-200 bg-white pl-[10px] pr-[10px] text-2xl shadow-lg">
          <div className="flex h-[72px] items-center justify-between space-x-2 pb-[20px] pt-[22px]">
            <div>
              <HighlightTerms
                messages={{
                  includeAll: t("HighlightTerms.includeAll"),
                  label: t("HighlightTerms.label"),
                  placeholder: t("HighlightTerms.placeholder"),
                }}
              />
            </div>
            <div className="text-nowrap">
              <Button
                variant="contained"
                onClick={handleGroupSelect}
                sx={{ fontSize: 14 }}
              >
                {groupSelectText}
              </Button>
            </div>
          </div>
          <div
            className="overflow-auto border-t-[2px] pl-[8px] pr-[8px] pt-[10px]"
            style={{ maxHeight: "calc(100vh - 286px)" }}
          >
            <FormGroup>
              {sources?.map((source, idx) => (
                <FormControlLabel
                  className="pb-[4px] pl-[9px] pt-[4px]"
                  style={{ marginRight: 0 }}
                  sx={{ ":hover": { backgroundColor: "#E8E8E8" } }}
                  key={`threat_${idx}`}
                  label={
                    <span style={{ fontSize: 16, paddingLeft: 9 }}>
                      {source}
                    </span>
                  }
                  control={
                    <Checkbox
                      style={{ padding: 0 }}
                      sx={{ "& .MuiSvgIcon-root": { fontSize: 24 } }}
                      value={source}
                      checked={selected.includes(source)}
                      onChange={handleCheckClick}
                    />
                  }
                />
              ))}
            </FormGroup>
          </div>
        </div>
      )}
    </div>
  );
}

function fallbackRender({ error }: FallbackProps) {
  const message: string = (error as Error).message;

  return (
    <div role="alert" data-testid="errorboundary">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{message}</pre>
    </div>
  );
}

export default function HighlightSource() {
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <HighlightSourceComponent />
    </ErrorBoundary>
  );
}
