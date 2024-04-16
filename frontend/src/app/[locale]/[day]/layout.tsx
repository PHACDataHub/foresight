import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

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
  const messages = await getMessages();

  const t = await getTranslations("App");
  const timeTravelMsg = await getTranslations("TimeTravel");
  const msgHighlightTerms = await getTranslations("HighlightTerms");
  const msgHistoryChooser = await getTranslations("HistoryChooser");
  
  const startDate = new Date(2019, 11, 1, 12);
  const endDate = new Date(2020, 0, 31, 12);
  const date = new Date(startDate);
  date.setDate(date.getDate() + parseInt(params.day) - 1);

  return (
    <AppWrapper>
      <div className="mt-[16px] flex items-center justify-between space-x-[10px] border-b pb-[16px] pr-[30px]">
        <div className="flex items-end space-x-[24px]  pl-[30px]">
          <Typography variant="h4" fontSize={24} fontWeight="medium">
            {t("title")}
          </Typography>
          <TodayIs
            messages={{
              todayIs: timeTravelMsg("chooseDate"),
            }}
            date={date}
          />
        </div>
        <div className="flex items-center space-x-[16px]">
          <div className="flex-1">
            <HighlightTerms
              messages={{
                label: msgHighlightTerms("label"),
                placeholder: msgHighlightTerms("placeholder"),
              }}
            />
          </div>
          <TimeTravel
            startDate={startDate}
            endDate={endDate}
            date={date}
            messages={{
              chooseDate: timeTravelMsg("chooseDate"),
              travelText: timeTravelMsg("travelText"),
            }}
          />
          <HistoryChooser
            messages={{
              label: msgHistoryChooser("label"),
              today: msgHistoryChooser("today"),
              last3: msgHistoryChooser("last3"),
              last7: msgHistoryChooser("last7"),
              last30: msgHistoryChooser("last30"),
            }}
          />
          <div className="flex-2">
            <NextIntlClientProvider
              messages={
                typeof messages.WorkingWith === "object"
                  ? messages.WorkingWith
                  : {}
              }
            >
              <WorkingWith />
            </NextIntlClientProvider>
          </div>
        </div>
        <NextIntlClientProvider
          messages={
            typeof messages.ThreatSelector === "object"
              ? messages.ThreatSelector
              : {}
          }
        >
          <ThreatSelector />
        </NextIntlClientProvider>
      </div>
      <div className="mb-[10px] flex flex-1 flex-col items-center justify-center overflow-hidden pr-[30px]">
        <NextIntlClientProvider
          messages={typeof messages.Graph === "object" ? messages.Graph : {}}
        >
          <Graph />
        </NextIntlClientProvider>
      </div>
      {children}
    </AppWrapper>
  );
}
