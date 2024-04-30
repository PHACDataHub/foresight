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
import { IconButton } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  date: propDate,
  startDate = new Date(2019, 11, 1, 12),
  endDate = new Date(2020, 0, 31, 12),
  onChange,
}: TimeTravelProps) {
  const { locale, day } = useParams();
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

  const date = useMemo(() => {
    if (propDate) return propDate;
    if (typeof day === "string") {
      const date = new Date(startDate);
      date.setDate(date.getDate() + parseInt(day) - 1);
      return date;
    }
    return startDate;
  }, [day, propDate, startDate]);

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

  const handlePrevDayClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const newDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() - 1,
        8,
      );
      if (onChange) {
        onChange(newDate, evt);
      }
      if (!evt.defaultPrevented && typeof locale === "string") {
        const d = (newDate.getTime() - startDate.getTime()) / 86400000;
        router.push(`/${locale}/${d + 1}`);
      }
      evt.preventDefault();
    },
    [date, locale, onChange, router, startDate],
  );

  const handleNextDayClick = useCallback(
    (evt: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const newDate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + 1,
        8,
      );
      if (onChange) {
        onChange(newDate, evt);
      }
      if (!evt.defaultPrevented && typeof locale === "string") {
        const d = (newDate.getTime() - startDate.getTime()) / 86400000;
        router.push(`/${locale}/${d + 1}`);
      }
      evt.preventDefault();
    },
    [date, locale, onChange, router, startDate],
  );

  const showPreviousMonths = useMemo(
    () => date.getMonth() === endDate.getMonth(),
    [date, endDate],
  );

  const highlights: Record<string, Date[]>[] = useMemo(
    () =>
      [
        {
          special_day: [new Date(2019, 11, 31), new Date(2020, 0, 5)],
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

  const hasPrev = useMemo(() => {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    return !(d === 1 && m === 11 && y === 2019);
  }, [date]);
  const hasNext = useMemo(() => {
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    return !(d === 31 && m === 0 && y === 2020);
  }, [date]);

  // const nextDay = useMemo(() => {
  //   if (typeof locale !== "string") return "#";
  //   const newDate = new Date(
  //     date.getFullYear(),
  //     date.getMonth(),
  //     date.getDate() + 1,
  //     8,
  //   );
  //   const d = (newDate.getTime() - startDate.getTime()) / 86400000;
  //   return `/${locale}/${d + 1}`;
  // }, [date, locale, startDate]);

  // const prevDay = useMemo(() => {
  //   if (typeof locale !== "string") return "#";
  //   const newDate = new Date(
  //     date.getFullYear(),
  //     date.getMonth(),
  //     date.getDate() - 1,
  //     8,
  //   );
  //   const d = (newDate.getTime() - startDate.getTime()) / 86400000;
  //   return `/${locale}/${d + 1}`;
  // }, [date, locale, startDate]);

  return (
    <nav className="sdp-timetravel mb-3 mt-3 flex space-x-2 whitespace-nowrap">
      <IconButton
        // href={prevDay}
        href=""
        disabled={!hasPrev}
        onClick={handlePrevDayClick}
        color="primary"
        sx={{ padding: 0 }}
        title="Previous Day"
      >
        <ChevronLeft size={30} />
      </IconButton>

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
            sx={{ fontSize: 14 }}
            variant="contained"
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
      <IconButton
        // href={nextDay}
        href=""
        onClick={handleNextDayClick}
        disabled={!hasNext}
        size="small"
        color="primary"
        sx={{ padding: 0 }}
        title="Next Day"
      >
        <ChevronRight size={30} />
      </IconButton>
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
