export default function dateToStr(
  locale: string | string[] | undefined,
  d: Date,
  long?: boolean,
) {
  return d.toLocaleDateString(
    locale,
    !long
      ? {
          dateStyle: "long",
        }
      : {
          dateStyle: "short",
        },
  );
}
