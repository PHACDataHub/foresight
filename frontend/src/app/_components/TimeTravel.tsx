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

import Button from "@mui/material/Button";

import "react-datepicker/dist/react-datepicker.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleDown } from "@fortawesome/free-solid-svg-icons";

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
      if (!evt.defaultPrevented && typeof locale === "string") {
        const d = (p.getTime() - startDate.getTime()) / 86400000;
        router.push(`/${locale}/${d + 1}`);
      }
    },
    [locale, onChange, router, startDate],
  );

  const showPreviousMonths = useMemo(
    () => date.getMonth() === endDate.getMonth(),
    [date, endDate],
  );

  const highlights: Record<string, Date[]>[] = useMemo(
    () =>
      [
        {
          special_day: [
            new Date(2019, 11, 31),
            new Date(2020, 0, 5),
          ]
        },
        {
          cluster_3_day: [
            new Date(2020, 0, 1),
            new Date(2020, 0, 2),
            new Date(2020, 0, 3),
            new Date(2020, 0, 4),
            new Date(2020, 0, 5),
            new Date(2020, 0, 6),
            new Date(2020, 0, 7),
            new Date(2020, 0, 8),
          ],
        },
        {
          cluster_6_day: [new Date(2020, 0, 6)],
        },
        {
          cluster_30_day: [new Date(2020, 0, 29)],
        },
      ] as Record<string, Date[]>[],
    [],
  );

  return (
    <nav className="mb-3 mt-3 flex items-center space-x-10">
      <DatePicker
        selected={date}
        minDate={startDate}
        maxDate={endDate}
        onChange={handleDateChange}
        highlightDates={highlights}
        monthsShown={2}
        showPreviousMonths={showPreviousMonths}
        locale={locale === "fr-CA" ? frCA : enCA}
        customInput={
          <Button
            variant="contained"
            style={{ backgroundColor: "#2196F3"}}
            size="medium"
            endIcon={<FontAwesomeIcon icon={faAngleDown} />}
          >
            {date.toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Button>
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
