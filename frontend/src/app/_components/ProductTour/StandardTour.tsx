import { type Step } from "react-joyride";
import Typography from "@mui/material/Typography";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

function StandardTour({ name }: { name: string }) {
  const t = useTranslations(`ProductTour.${name}`);
  const title = useMemo(() => t("title"), [t]);
  const content = useMemo(
    () =>
      t.rich("content", {
        strong: (c) => <strong>{c}</strong>,
        p: (c) => <span className="block mt-2">{c}</span>,
      }),
    [t],
  );
  return (
    <div>
      <Typography variant="h4">{title}</Typography>
      <Typography variant="body1">{content}</Typography>
    </div>
  );
}

export default function standardTourFactory() {
  const tours: string[] = [];
  return {
    create: function createStandardTour(
      name: string,
      step: Omit<Step, "content">,
      interact?: boolean,
    ): Step {
      tours.push(name);
      const i = interact
        ? {
            disableBeacon: true,
            disableOverlayClose: true,
            hideCloseButton: true,
            hideFooter: true,
            spotlightClicks: true,
          }
        : {};
      return {
        ...i,
        ...step,
        content: <StandardTour name={name} />,
      };
    },
    indexOf: function indexOf(name: string) {
      return tours.indexOf(name);
    },
  };
}
