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
        variant="contained"
        endIcon={<FontAwesomeIcon icon={faAngleDown} />}
        onClick={handleOpenClick}
      >
        Filter View
      </Button>
      {open && (
        <div className="absolute right-0 z-[402] flex w-[450px] flex-col  border border-black bg-white p-10 text-2xl">
          <div className="flex justify-end space-x-5">
            <Button variant="contained" onClick={handleGroupSelect}>
              {groupSelectText}
            </Button>
            <Button
              variant="contained"
              onClick={handleResetClick}
              color="error"
            >
              Reset to default
            </Button>
          </div>
          <div className="m-5 max-h-[50vh] overflow-auto pl-5">
            <FormGroup>
              {threats?.map((threat, idx) => (
                <FormControlLabel
                  className=""
                  key={`threat_${idx}`}
                  label={threat.text}
                  control={
                    <Checkbox
                      style={{ padding: "0px 5px 0px 0px" }}
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
