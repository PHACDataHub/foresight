import { useMemo } from "react";
import { useTranslations } from "next-intl";

export function TourLabel({ label }: { label: string }) {
  const t = useTranslations("ProductTour");
  const txt = useMemo(() => t(label), [t, label]);
  return <>{txt}</>;
}

const locale = {
  back: <TourLabel label="back" />,
  close: <TourLabel label="close" />,
  last: <TourLabel label="last" />,
  next: <TourLabel label="next" />,
  open: <TourLabel label="open" />,
  skip: <TourLabel label="skip" />,
};

export default locale;
