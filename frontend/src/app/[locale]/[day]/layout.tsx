import { getTranslations } from "next-intl/server";

import AppWrapper from "~/app/_components/AppWrapper";
import Graph from "~/app/_components/graph";
import HistoryChooser from "~/app/_components/HistoryChooser";
import TimeTravel from "~/app/_components/TimeTravel";

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
    <AppWrapper title={t("title")}>
      <div className="flex justify-between">
        <TimeTravel
          startDate={startDate}
          endDate={endDate}
          date={date}
          messages={{
            chooseDate: timeTravelMsg("chooseDate"),
            travelText: timeTravelMsg("travelText"),
          }}
        />
        <HistoryChooser />
      </div>
      <div className="mb-10 flex flex-1 flex-col items-center justify-center overflow-hidden">
        <Graph />
      </div>
      {/* <TextView /> */}
      {children}
    </AppWrapper>
  );
}
