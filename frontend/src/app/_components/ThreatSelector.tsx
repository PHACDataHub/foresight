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
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import { useTranslations } from "next-intl";
import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";

function ThreatSelectorComponent() {
  const [open, setOpen] = useState(false);
  const { threats: selected, setThreats, persona } = useStore();
  const t = useTranslations();
  const { data: threats } = api.post.threats.useQuery(
    { persona },
    {
      refetchOnWindowFocus: false,
    },
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
      const items = selected.filter((s) => s !== evt.target.value);
      if (evt.target.checked) items.push(evt.target.value);
      setThreats(items);
    },
    [selected, setThreats],
  );

  const preventPropagation = useCallback(
    (e: React.MouseEvent<HTMLDivElement, Event>) => {
      e.stopPropagation();
    },
    [],
  );

  const handleResetClick = useCallback(() => {
    setThreats(null);
  }, [setThreats]);

  const handleGroupSelect = useCallback(() => {
    if (!threats) return;
    const items =
      selected.length === threats.length ? [] : threats.map((t) => t.text);
    setThreats(items);
  }, [selected.length, setThreats, threats]);

  const groupSelectText = useMemo(() => {
    if (!threats || threats.length !== selected.length) return t("selectall");
    return t("selectnone");
  }, [t, selected.length, threats]);

  if (persona === "tom" || persona === "rachel") return <></>;

  return (
    <div className="sdp-threat-sel relative" onClick={preventPropagation}>
      <Button
        sx={{ fontSize: 14 }}
        className="whitespace-nowrap"
        variant="contained"
        endIcon={<FontAwesomeIcon icon={faAngleDown} />}
        onClick={handleOpenClick}
      >
        {t("filterView")}
      </Button>
      {open && (
        <div className="sdp-threat-sel-list absolute right-0 z-[1402] flex w-[600px] flex-col rounded-lg  border-[2px] border-gray-200 bg-white pl-[10px] pr-[10px] text-2xl shadow-lg">
          <div className="flex h-[52px] items-center justify-between pb-[20px] pt-[22px]">
            <Chip
              label={t("selected", { count: selected.length })}
              sx={{ fontSize: 14 }}
            />
            <div className="space-x-[10px]">
              <Button
                variant="contained"
                onClick={handleGroupSelect}
                sx={{ fontSize: 14 }}
              >
                {groupSelectText}
              </Button>
              <Button
                variant="contained"
                onClick={handleResetClick}
                color="error"
                sx={{ fontSize: 14 }}
              >
                {t("resetToDefault")}
              </Button>
            </div>
          </div>
          <div
            className="overflow-auto border-t-[2px] pl-[8px] pr-[8px] pt-[10px]"
            style={{ maxHeight: "calc(100vh - 286px)" }}
          >
            <FormGroup>
              {threats?.map((threat, idx) => (
                <FormControlLabel
                  className="pb-[4px] pl-[9px] pt-[4px]"
                  style={{ marginRight: 0 }}
                  sx={{ ":hover": { backgroundColor: "#E8E8E8" } }}
                  key={`threat_${idx}`}
                  label={
                    <span style={{ fontSize: 16, paddingLeft: 9 }}>
                      {threat.text}
                    </span>
                  }
                  control={
                    <Checkbox
                      style={{ padding: 0 }}
                      sx={{ "& .MuiSvgIcon-root": { fontSize: 24 } }}
                      value={threat.text}
                      checked={selected.includes(threat.text)}
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

export default function ThreatSelector() {
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <ThreatSelectorComponent />
    </ErrorBoundary>
  );
}
