"use client";

import React, { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

// @ts-expect-error No type declarations
import Slider from "react-slide-out";

import "react-slide-out/lib/index.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleDown } from "@fortawesome/free-solid-svg-icons";
import FormGroup from "@mui/material/FormGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Button from "@mui/material/Button";
import { useStore } from "~/app/_store";
import useDelayedResizeObserver from "~/app/_hooks/useDelayedResizeObserver";
import { api } from "~/trpc/react";

function ThreatSelectorComponent() {
  const [open, setOpen] = useState(false);
  const { threats: selected, setThreats } = useStore();
  const { data: threats } = api.post.threats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

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

  const header = useDelayedResizeObserver("def-appTop");
  const footer = useDelayedResizeObserver("wb-info");

  return (
    <div className="relative">
      <Button
        variant="contained"
        endIcon={<FontAwesomeIcon icon={faAngleDown} />}
        onClick={handleOpenClick}
      >
        Filter View
      </Button>
      {open && (
        <div className="absolute right-0 z-50 flex w-[600px] flex-col  border border-black bg-white p-10 text-2xl">
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
          <div className="max-h-[50vh] overflow-auto">
            <FormGroup>
              {threats?.map((threat, idx) => (
                <FormControlLabel
                  key={`threat_${idx}`}
                  label={threat.text}
                  control={
                    <Checkbox
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

  return (
    <Slider
      verticalOffset={{ top: header, bottom: footer }}
      isOpen
      foldMode
      isFolded={!open}
      foldWidth="66px"
    >
      {open && (
        <div className="flex flex-col text-2xl">
          <div className="flex justify-end space-x-5">
            <button className="btn btn-primary" onClick={handleGroupSelect}>
              {groupSelectText}
            </button>
            <button className="btn btn-danger" onClick={handleResetClick}>
              Reset
            </button>
            <button className="btn btn-primary" onClick={handleOpenClick}>
              <span className="glyphicon glyphicon-chevron-right" />
            </button>
          </div>
          <ul>
            {threats?.map((threat, idx) => (
              <li key={`threat_${idx}`}>
                <input
                  type="checkbox"
                  id={`threat_box_${idx}`}
                  value={threat.text}
                  onChange={handleCheckClick}
                  checked={selected.includes(threat.text)}
                />
                <label className="small" htmlFor={`threat_box_${idx}`}>
                  {threat.text}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!open && (
        <div className="flex justify-end space-x-5">
          <button className="btn btn-primary" onClick={handleOpenClick}>
            <span className="glyphicon glyphicon-chevron-left" />
          </button>
        </div>
      )}
    </Slider>
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
