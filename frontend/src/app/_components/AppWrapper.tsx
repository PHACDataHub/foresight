"use client";

import { useParams } from "next/navigation";
import React from "react";
import { AppTemplate, useLngLinks } from "@arcnovus/wet-boew-react";

import useWetLang from "~/app/_hooks/useWetLang";

export default function AppWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = useParams();
  const lang = useWetLang();
  const { lngLinks } = useLngLinks({
    currentLanguage: lang,
    translatedPage: locale === "en-CA" ? "/fr-CA/1" : "/en-CA/1",
  });

  return (
    <div className="flex h-full max-h-[100%] min-h-[100%] flex-col">
      <AppTemplate
        appName={[]}
        lngLinks={lngLinks}
        showShare={false}
        showFeedback={false}
        showPostContent={false}
      >
        <div className="flex flex-1 flex-col">{children}</div>
      </AppTemplate>
    </div>
  );
}
