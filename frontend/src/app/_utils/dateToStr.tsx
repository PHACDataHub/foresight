export default function dateToStr(
  locale: string | string[] | undefined,
  d: Date,
  long?: boolean,
) {
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
}
