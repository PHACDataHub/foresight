import { useCallback } from "react";

export default function useDateToStr(locale: string | string[] | undefined) {
  return useCallback(
    (d: Date, long?: boolean) => {
      return d.toLocaleDateString(
        locale,
        !long
          ? {
              day: "numeric",
              month: "short",
              year: "numeric",
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
}
