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
        p: (c) => <span className="mt-2 block">{c}</span>,
      }),
    [t],
  );
  return (
    <div>
      <Typography variant="h4" className="mb-4">
        {title}
      </Typography>
      <Typography variant="body1" className="text-left">
        {content}
      </Typography>
    </div>
  );
}

export default function standardTourFactory<K extends string>(
  steps: Record<
    K,
    {
      step: Omit<Step, "content">;
      interact?: boolean;
    }
  >,
) {
  const tours: K[] = Object.keys(steps) as K[];
  const factory = {
    steps: () => {
      return tours.map((t) => {
        const s = steps[t];
        const i = s.interact
          ? {
              disableBeacon: true,
              disableOverlayClose: true,
              hideFooter: true,
              spotlightClicks: true,
            }
          : {};
        return {
          ...i,
          ...s.step,
          content: <StandardTour name={t} />,
        } as Step;
      });
    },
    indexOf: function indexOf(name: K) {
      return tours.indexOf(name);
    },
    stepMachine: function stepMachine(
      index: number,
      stepDirection: "forward" | "backward",
    ) {
      const transitionIndex = index + (stepDirection === "forward" ? 1 : -1);
      return {
        into: (step: K, action: () => void) => {
          if (tours.indexOf(step) === transitionIndex) action();
          return factory.stepMachine(index, stepDirection);
        },
        forwardInto: (step: K, action: () => void) => {
          if (
            stepDirection === "forward" &&
            tours.indexOf(step) === transitionIndex
          )
            action();
          return factory.stepMachine(index, stepDirection);
        },
        backwardInto: (step: K, action: () => void) => {
          if (
            stepDirection === "backward" &&
            tours.indexOf(step) === transitionIndex
          )
            action();
          return factory.stepMachine(index, stepDirection);
        },
        outOf: (step: K, action: () => void) => {
          if (tours.indexOf(step) === index) action();
          return factory.stepMachine(index, stepDirection);
        },
        forwardOutOf: (step: K, action: () => void) => {
          if (stepDirection === "forward" && tours.indexOf(step) === index)
            action();
          return factory.stepMachine(index, stepDirection);
        },
        backwardOutOf: (step: K, action: () => void) => {
          if (
            stepDirection === "backward" &&
            tours.indexOf(step) === index &&
            transitionIndex === index - 1
          )
            action();
          return factory.stepMachine(index, stepDirection);
        },
      };
    },
  };
  return factory;
}
