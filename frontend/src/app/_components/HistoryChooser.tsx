"use client";

import { useParams, useRouter } from "next/navigation";
import { type MouseEvent, useCallback, useMemo } from "react";
import { useStore } from "~/app/_store";

export default function HistoryChooser() {
  const { history } = useStore();
  const router = useRouter();
  const { locale, day } = useParams();

  const handleClick = useCallback(
    (evt: MouseEvent<HTMLButtonElement>) => {
      const t = parseInt(evt.currentTarget.value);
      if (typeof locale === "string" && typeof day === "string") {
        if (t === 3 || t === 7 || t === 30) {
          router.push(`/${locale}/${day}/${t}`);
        } else {
          router.push(`/${locale}/${day}`);
        }
      }
    },
    [day, locale, router],
  );

  const dayNum = useMemo(
    () => (typeof day === "string" ? parseInt(day) : -1),
    [day],
  );

  return (
    <div className="btn btn-group mb-3 mt-3 p-0">
      <button
        onClick={handleClick}
        className={`btn btn-default${!history ? " active" : ""}`}
      >
        single day
      </button>
      <button
        onClick={handleClick}
        disabled={dayNum < 33 || dayNum > 39}
        value={3}
        className={`btn btn-default${history === 3 ? " active" : ""}`}
      >
        last 3 days
      </button>
      <button
        onClick={handleClick}
        disabled={dayNum !== 37}
        value={7}
        className={`btn btn-default${history === 7 ? " active" : ""}`}
      >
        last 7 days
      </button>
      <button
        onClick={handleClick}
        disabled={dayNum !== 60}
        value={30}
        className={`btn btn-default${history === 30 ? " active" : ""}`}
      >
        1 month
      </button>
    </div>
  );
}
