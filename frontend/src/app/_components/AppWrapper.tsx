"use client";

import { useParams } from "next/navigation";
import React from "react";
import { AppTemplate, useLngLinks } from "@arcnovus/wet-boew-react";

import useWetLang from "~/app/_hooks/useWetLang";

export default function AppWrapper({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { locale } = useParams();
  const lang = useWetLang();
  const { lngLinks } = useLngLinks({
    currentLanguage: lang,
    translatedPage: locale === "en-CA" ? "/fr-CA/1" : "/en-CA/1",
  });

  return (
    <div className="h-full">
      <AppTemplate
        appName={[{ text: title, href: "/" }]}
        lngLinks={lngLinks}
        showShare={false}
        showFeedback={false}
      >
        <div>{children}</div>
      </AppTemplate>
    </div>
  );
}
