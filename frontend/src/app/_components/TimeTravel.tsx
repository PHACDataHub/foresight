"use client";

/**
 * Component used to display dates between `startDate` and `endDate` for
 * the user to select.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import useDateToStr from "~/app/_hooks/useDateToStr";

type TimeTravelProps = {
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  messages?: {
    chooseDate?: string;
    travelText?: string;
    currentDate?: string;
    startButton?: string;
    previousButton?: string;
    nextButton?: string;
    lastButton?: string;
  };
  onChange?: (
    date: Date,
    event?: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
  ) => void;
};

function TimeTravelComponent({
  date = new Date(2019, 11, 1, 12),
  startDate = new Date(2019, 11, 1, 12),
  endDate = new Date(2020, 0, 31, 12),
  messages,
  onChange,
}: TimeTravelProps) {
  if (endDate < startDate)
    throw new Error("endDate must occur after startDate");
  if (!(date >= startDate && date <= endDate))
    throw new Error("Specified date outside of range");
  const days =
    Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  if (days > 100) throw new Error("Only 100 days are supported.");

  const { locale } = useParams();
  const selectedDate = useRef<HTMLAnchorElement>(null);

  const dateToStr = useDateToStr(locale);

  useEffect(() => {
    const c = selectedDate.current;
    if (c?.scrollIntoView) {
      c.scrollIntoView({
        behavior: "auto",
        inline: "center",
        block: "end"
      });
    }
  }, [selectedDate]);

  const dayMap = useMemo(
    () =>
      Array.from({ length: days }, (_, i) => {
        const r = new Date(startDate);
        r.setDate(r.getDate() + i);
        return r;
      }),
    [days, startDate],
  );

  const handleDateChange = useCallback(
    (p: Date) => (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (onChange) {
        onChange(p, evt);
      }
    },
    [onChange],
  );

  const currentIndex = useMemo(() => {
    return (
      dayMap
        .map((d, i) => [d, i] as [Date, number])
        .filter(([d]) => d.getTime() === date.getTime())
        .reduce((p, c) => c[1], -1) + 1
    );
  }, [dayMap, date]);

  const prevDisabled = useMemo(
    () => date.getTime() === startDate.getTime(),
    [date, startDate],
  );

  const nextDisabled = useMemo(
    () => date.getTime() === endDate.getTime(),
    [date, endDate],
  );

  return (
    <nav>
      <h4 className="small">{messages?.chooseDate ?? "title"}</h4>
      <div className="flex space-x-2">
        <ul className="pagination" style={{ marginTop: 0 }}>
          <li>
            <Link
              className={`btn btn-sm mr-2${prevDisabled && " disabled pointer-events-none"}`}
              aria-disabled={prevDisabled}
              tabIndex={prevDisabled ? -1 : undefined}
              onClick={handleDateChange(startDate)}
              href={"1"}
              style={{ minHeight: 0, padding: 5 }}
            >
              <span className="glyphicon glyphicon-fast-backward" aria-hidden />
              &nbsp;
              <span className="wb-inv">{messages?.startButton ?? "Start"}</span>
            </Link>
          </li>
          <li>
            <Link
              className={`btn btn-sm mr-2${prevDisabled && " disabled pointer-events-none"}`}
              aria-disabled={prevDisabled}
              tabIndex={prevDisabled ? -1 : undefined}
              onClick={handleDateChange(dayMap[currentIndex - 2] ?? date)}
              href={`${currentIndex - 1}`}
              style={{ minHeight: 0, padding: 5 }}
            >
              <span className="glyphicon glyphicon-backward" aria-hidden />
              &nbsp;
              <span className="wb-inv">
                {messages?.previousButton ?? "Previous"}
              </span>
            </Link>
          </li>
        </ul>

        <ul
          className="pagination flex-1 overflow-x-scroll whitespace-nowrap"
          style={{ marginTop: 0 }}
        >
          {dayMap.map((p, i) => (
            <li
              key={`day_${p.getTime()}`}
              className={`mr-2 ${date.getTime() === p.getTime() ? "active" : ""}`}
              style={{ display: "inline" }}
            >
              <Link
                style={{ float: "none", minHeight: 0, padding: 5 }}
                onClick={handleDateChange(p)}
                className="btn btn-sm"
                href={`${i + 1}`}
                ref={date.getTime() === p.getTime() ? selectedDate : undefined}
              >
                {dateToStr(p)}
                <span className="wb-inv">
                  {date.getTime() === p.getTime()
                    ? `(${messages?.currentDate ?? "current"})`
                    : ""}{" "}
                  {messages?.travelText ?? "travel to"} {dateToStr(p, true)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <ul className="pagination" style={{ marginTop: 0 }}>
          <li>
            <Link
              className={`btn btn-sm mr-2${nextDisabled && " disabled pointer-events-none"}`}
              aria-disabled={nextDisabled}
              tabIndex={nextDisabled ? -1 : undefined}
              onClick={handleDateChange(dayMap[currentIndex] ?? date)}
              href={`${currentIndex + 1}`}
              style={{ minHeight: 0, padding: 5 }}
            >
              <span className="glyphicon glyphicon-forward" aria-hidden />
              &nbsp;
              <span className="wb-inv">{messages?.nextButton ?? "Next"}</span>
            </Link>
          </li>
          <li>
            <Link
              className={`btn btn-sm mr-2${nextDisabled && " disabled pointer-events-none"}`}
              aria-disabled={nextDisabled}
              tabIndex={nextDisabled ? -1 : undefined}
              onClick={handleDateChange(endDate)}
              href={`${dayMap.length}`}
              style={{ minHeight: 0, padding: 5 }}
            >
              <span className="glyphicon glyphicon-fast-forward" aria-hidden />
              &nbsp;
              <span className="wb-inv">{messages?.lastButton ?? "End"}</span>
            </Link>
          </li>
        </ul>
      </div>
    </nav>
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

export default function TimeTravel(props: TimeTravelProps) {
  return (
    <ErrorBoundary fallbackRender={fallbackRender}>
      <TimeTravelComponent {...props} />
    </ErrorBoundary>
  );
}
