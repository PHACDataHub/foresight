"use client";

import React, { type ChangeEvent, useCallback, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

// @ts-expect-error No type declarations
import Slider from "react-slide-out";

import "react-slide-out/lib/index.css";
import { api } from "~/trpc/react";
import useDelayedResizeObserver from "~/app/_hooks/useDelayedResizeObserver";

type ThreatSelectorProps = {
  selected: string[];
  onChange?: (selected: string[]) => void;
};

function ThreatSelectorComponent({ selected, onChange }: ThreatSelectorProps) {
  const [open, setOpen] = useState(false);
  const [initialThreats] = useState(selected);
  const { data: threats } = api.post.threats.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const handleOpenClick = useCallback(() => {
    setOpen(!open);
  }, [open]);

  const handleCheckClick = useCallback(
    (evt: ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return;
      const items = selected.filter((s) => s !== evt.target.value);
      if (evt.target.checked) items.push(evt.target.value);
      onChange(items);
    },
    [onChange, selected],
  );

  const handleResetClick = useCallback(() => {
    if (onChange) onChange(initialThreats);
  }, [initialThreats, onChange]);

  const handleGroupSelect = useCallback(() => {
    if (!threats) return;
    const items = selected.length === threats.length ? [] : threats.map((t) => t.text);
    if (onChange) onChange(items);
  }, [onChange, selected.length, threats]);

  const groupSelectText = useMemo(() => {
    if (!threats || threats.length !== selected.length) return "Select All";
    return "Select None";
  }, [selected.length, threats])

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
          <div className="mr-10 flex justify-between">
            <button className="btn btn-primary" onClick={handleOpenClick}>
              <span className="glyphicon glyphicon-chevron-right" />
            </button>
            <div className="flex space-x-5">
              <button className="btn btn-primary" onClick={handleGroupSelect}>
                {groupSelectText}
              </button>
              <button className="btn btn-danger" onClick={handleResetClick}>
                Reset
              </button>
            </div>
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
        <button className="btn btn-primary" onClick={handleOpenClick}>
          <span className="glyphicon glyphicon-chevron-left" />
        </button>
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

export default function ThreatSelector(props: ThreatSelectorProps) {
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <ThreatSelectorComponent {...props} />
    </ErrorBoundary>
  );
}