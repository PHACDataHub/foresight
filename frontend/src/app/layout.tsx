import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

import { getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

import Typography from "@mui/material/Typography";

import AppWrapper from "~/app/_components/AppWrapper";
import PanelInterface from "~/app/_components/PanelInterface";
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

import "~/styles/globals.css";

import { TRPCReactProvider } from "~/trpc/react";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  const t = await getTranslations("App");
  const timeTravelMsg = await getTranslations("TimeTravel");
  const msgHighlightTerms = await getTranslations("HighlightTerms");
  const msgHistoryChooser = await getTranslations("HistoryChooser");

  return (
    <TRPCReactProvider>
      <html className="no-js h-full">
        <body className="h-full">
          <NextIntlClientProvider
            messages={
              typeof messages.AppWrapper === "object" ? messages.AppWrapper : {}
            }
          >
            <AppWrapper>
              <div className="mt-[16px] flex items-center justify-between space-x-[10px] border-b pb-[16px] pr-[30px]">
                <div className="flex flex-1 items-end space-x-[24px]  pl-[30px]">
                  <Typography variant="h4" fontSize={24} fontWeight="medium">
                    {t("title")}
                  </Typography>
                  <TodayIs
                    messages={{
                      todayIs: timeTravelMsg("chooseDate"),
                    }}
                  />
                </div>
                <div className="sdp-search-filter flex flex-[3] items-center justify-between">
                  <div className="flex items-center space-x-[16px]">
                    <div className="sdp-hightlight-terms flex-1">
                      <HighlightTerms
                        messages={{
                          label: msgHighlightTerms("label"),
                          placeholder: msgHighlightTerms("placeholder"),
                          includeAll: msgHighlightTerms("includeAll"),
                        }}
                      />
                    </div>
                    <TimeTravel
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
                  </div>
                  <div className="sdp-count-filter ml-8 flex flex-1 items-center justify-between">
                    <NextIntlClientProvider
                      messages={
                        typeof messages.WorkingWith === "object"
                          ? messages.WorkingWith
                          : {}
                      }
                    >
                      <WorkingWith />
                    </NextIntlClientProvider>

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
                </div>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center overflow-hidden pr-[30px]">
                <NextIntlClientProvider
                  messages={
                    typeof messages.Graph === "object" ? messages.Graph : {}
                  }
                >
                  <PanelInterface />
                </NextIntlClientProvider>
              </div>
              {children}
            </AppWrapper>
          </NextIntlClientProvider>
        </body>
      </html>
    </TRPCReactProvider>
  );
}
