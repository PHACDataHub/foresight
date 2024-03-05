import { useCallback } from "react";
import dateToStr from "~/app/_utils/dateToStr";

export default function useDateToStr(locale: string | string[] | undefined) {
  return useCallback(
    (d: Date, long?: boolean) => {
      return dateToStr(locale, d, long);
    },
    [locale],
  );
}
