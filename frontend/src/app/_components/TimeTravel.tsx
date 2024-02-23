"use client";

/**
 * Component used to display dates between `startDate` and `endDate` for
 * the user to select.
 */
import { useParams } from "next/navigation";
import { useCallback, useMemo } from "react";

export default function TimeTravel({
  date = new Date(2019, 11, 1),
  startDate = new Date(2019, 11, 1),
  endDate = new Date(2020, 0, 31),
  messages,
  onChange,
}: {
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  messages?: { chooseDate?: string; travelText?: string; currentDate?: string };
  onChange?: (date: Date) => void;
}) {
  if (endDate < startDate)
    throw new Error("endDate must occur after startDate");
  if (!(date >= startDate && date <= endDate))
    throw new Error("Specified date outside of range");
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
  if (days > 100) throw new Error("Only 100 days are supported.");

  const { locale } = useParams();

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
      evt.preventDefault();
      evt.stopPropagation();
      if (onChange) {
        onChange(p);
      }
    },
    [onChange],
  );

  const dateToStr = useMemo(
    () => (d: Date, long?: boolean) => {
      return d.toLocaleDateString(
        locale,
        !long
          ? {
              day: "numeric",
              month: "short",
              year: "2-digit",
            }
          : {
              day: "2-digit",
              month: "long",
              year: "numeric",
            },
      );
    },
    [locale],
  );

  return (
    <nav>
      <h4 className="small">{messages?.chooseDate ?? "title"}</h4>
      <ul
        className="pagination w-full overflow-x-scroll whitespace-nowrap"
        style={{ marginTop: 0 }}
      >
        {dayMap.map((p) => (
          <li
            key={`day_${p.getTime()}`}
            className={`mr-2 ${date.getTime() === p.getTime() ? "active" : ""}`}
            style={{ display: "inline" }}
          >
            <a
              style={{ float: "none" }}
              onClick={handleDateChange(p)}
              className="btn btn-sm"
            >
              {dateToStr(p)}
              <span className="wb-inv">
                {date.getTime() === p.getTime()
                  ? `(${messages?.currentDate ?? "current"})`
                  : ""}{" "}
                {messages?.travelText ?? "travel to"} {dateToStr(p, true)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
