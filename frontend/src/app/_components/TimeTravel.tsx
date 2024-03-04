"use client";

/**
 * Component used to display dates between `startDate` and `endDate` for
 * the user to select.
 */

import { useParams, useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { enCA, frCA } from "date-fns/locale";
import useDateToStr from "~/app/_hooks/useDateToStr";

import "react-datepicker/dist/react-datepicker.css";

type TimeTravelProps = {
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  messages?: {
    chooseDate?: string;
    travelText?: string;
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

  const router = useRouter();

  const dateToStr = useDateToStr(locale);

  useEffect(() => {
    const c = selectedDate.current;
    if (c?.scrollIntoView) {
      c.scrollIntoView({
        behavior: "auto",
        inline: "center",
        block: "end",
      });
    }
  }, [selectedDate]);

  const handleDateChange = useCallback(
    (p: Date, evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (onChange) {
        onChange(p, evt);
      }
      if (!evt.defaultPrevented) {
        const d = (p.getTime() - startDate.getTime()) / 86400000;
        router.push(`${d + 1}`);
      }
    },
    [onChange, router, startDate],
  );

  const showPreviousMonths = useMemo(
    () => date.getMonth() === endDate.getMonth(),
    [date, endDate],
  );

  return (
    <nav className="mb-3 mt-3 flex items-center space-x-10">
      <h4 className="small m-0 p-0">
        {messages?.chooseDate ?? "title"} {dateToStr(date)}
      </h4>
      <DatePicker
        selected={date}
        minDate={startDate}
        maxDate={endDate}
        onChange={handleDateChange}
        monthsShown={2}
        showPreviousMonths={showPreviousMonths}
        locale={locale === "fr-CA" ? frCA : enCA}
        customInput={
          <button className="btn btn-warning">
            {messages?.travelText ?? "Time Travel"}
          </button>
        }
        calendarClassName="timeTravelCalendar"
      />
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
