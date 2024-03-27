import { getTranslations } from "next-intl/server";

import Typography from "@mui/material/Typography";

import AppWrapper from "~/app/_components/AppWrapper";
import Graph from "~/app/_components/graph";
import HighlightTerms from "~/app/_components/HighlightTerms";
import HistoryChooser from "~/app/_components/HistoryChooser";
import TimeTravel from "~/app/_components/TimeTravel";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import TodayIs from "~/app/_components/TodayIs";
import ThreatSelector from "~/app/_components/ThreatSelector";
import WorkingWith from "~/app/_components/WorkingWith";

export default async function LocaleDayLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { day: string; locale: string };
}) {
  const t = await getTranslations("App");
  const timeTravelMsg = await getTranslations("TimeTravel");

  const startDate = new Date(2019, 11, 1, 12);
  const endDate = new Date(2020, 0, 31, 12);
  const date = new Date(startDate);
  date.setDate(date.getDate() + parseInt(params.day) - 1);

  return (
    <AppWrapper>
      <div className="flex items-center justify-between pb-[16px] pt-[16px] pl-[30px]">
        <Typography
          variant="h4"
          fontSize={24}
          fontWeight="medium"
          className="pr-[24px]"
        >
          {t("title")}
        </Typography>
        <TodayIs
          messages={{
            todayIs: timeTravelMsg("chooseDate"),
          }}
          date={date}
        />
        <div className="flex items-center space-x-4">
          <HighlightTerms />
          <TimeTravel
            startDate={startDate}
            endDate={endDate}
            date={date}
            messages={{
              chooseDate: timeTravelMsg("chooseDate"),
              travelText: timeTravelMsg("travelText"),
            }}
          />
          <WorkingWith />
          <HistoryChooser />
        </div>
        <ThreatSelector />
      </div>
      <div className="mb-[10px] flex flex-1 flex-col items-center justify-center overflow-hidden">
        <Graph />
      </div>
      {children}
    </AppWrapper>
  );
}
