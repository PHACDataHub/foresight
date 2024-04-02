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
import ButtonGroup from "@mui/material/ButtonGroup";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import { useStore } from "~/app/_store";
import { api } from "~/trpc/react";

function ThreatSelectorComponent() {
  const [open, setOpen] = useState(false);
  const { threats: selected, setThreats } = useStore();
  const { data: threats } = api.post.threats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (open) {
      const onClose = () => setOpen(false);
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
    if (!threats || threats.length !== selected.length) return "Select All";
    return "Select None";
  }, [selected.length, threats]);

  return (
    <div className="relative" onClick={preventPropagation}>
      <Button
        sx={{ fontSize: 14 }}
        className="whitespace-nowrap"
        variant="contained"
        endIcon={<FontAwesomeIcon icon={faAngleDown} />}
        onClick={handleOpenClick}
      >
        Filter View
      </Button>
      {open && (
        <div className="absolute right-0 z-[402] flex w-[600px] flex-col  border border-black bg-white pl-[4px] pr-[4px] text-2xl">
          <div className="flex h-[52px] justify-between pb-[8px] pt-[8px]">
            <Chip label={`${selected.length} Selected`} sx={{ fontSize: 14 }} />
            <ButtonGroup className="space-x-[10px]">
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
                Reset to default
              </Button>
            </ButtonGroup>
          </div>
          <div
            className="overflow-auto pl-[8px] pr-[8px]"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          >
            <FormGroup>
              {threats?.map((threat, idx) => (
                <FormControlLabel
                  className="h-[40px] pl-[9px]"
                  style={{ marginRight: 0}}
                  sx={{ ":hover": { backgroundColor: "#E8E8E8" }}}
                  key={`threat_${idx}`}
                  label={<span style={{ fontSize: 16, paddingLeft: 9 }}>{threat.text}</span>}
                  control={
                    <Checkbox
                      style={{ padding: 0 }}
                      sx={{ '& .MuiSvgIcon-root': { fontSize: 42 } }}
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
