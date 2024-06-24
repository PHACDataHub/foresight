import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

import {
  getMessages,
  getTranslations,
  unstable_setRequestLocale,
} from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getPathname } from "@nimpl/getters/get-pathname";
import { getParams } from "@nimpl/getters/get-params";

import Typography from "@mui/material/Typography";

import React from "react";
import AppWrapper from "~/app/_components/AppWrapper";
import PanelInterface from "~/app/_components/PanelInterface";
import HistoryChooser from "~/app/_components/HistoryChooser";
import TimeTravel from "~/app/_components/TimeTravel";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import TodayIs from "~/app/_components/TodayIs";
import ThreatSelector from "~/app/_components/ThreatSelector";
import WorkingWith from "~/app/_components/WorkingWith";
import Session from "~/app/_components/Session";
import HighlightSource from "~/app/_components/HighlightSource";
import PrimarySearch from "~/app/_components/PrimarySearch";

import "~/styles/globals.css";

import { TRPCReactProvider } from "~/trpc/react";

// Can be imported from a shared config
const locales = ["en-CA", "fr-CA"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathName = getPathname();
  const params = getParams();

  if (!pathName) return null;
  if (pathName === "/") return <>{children}</>;

  unstable_setRequestLocale((params.locale as string) ?? "en-CA");

  const messages = await getMessages();

  const t = await getTranslations("App");
  const timeTravelMsg = await getTranslations("TimeTravel");
  const msgHighlightTerms = await getTranslations("HighlightTerms");
  const msgHistoryChooser = await getTranslations("HistoryChooser");

  return (
    <TRPCReactProvider>
      <html className="no-js h-full">
        <head>
          <title>{t("title")}</title>
        </head>
        <body className="h-full">
          <NextIntlClientProvider
            messages={
              typeof messages.AppWrapper === "object" ? messages.AppWrapper : {}
            }
          >
            <Session>
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
                        <PrimarySearch
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

                      <NextIntlClientProvider
                        messages={typeof messages === "object" ? messages : {}}
                      >
                        <HighlightSource />
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
            </Session>
          </NextIntlClientProvider>
        </body>
      </html>
    </TRPCReactProvider>
  );
}
