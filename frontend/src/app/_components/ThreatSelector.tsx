"use client";

import React, { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

// @ts-expect-error No type declarations
import Slider from "react-slide-out";

import "react-slide-out/lib/index.css";
import { api } from "~/trpc/react";
import useDelayedResizeObserver from "~/app/_hooks/useDelayedResizeObserver";
import { useStore } from "~/app/_store";

function ThreatSelectorComponent() {
  const [open, setOpen] = useState(false);
  const { threats: selected, setThreats } = useStore();
  const [initialThreats] = useState(selected);
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
    setThreats(initialThreats);
  }, [initialThreats, setThreats]);

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
